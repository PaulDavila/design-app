#!/usr/bin/env bash
# Crea VCN pública mínima + instancia Compute en una región OCI (p. ej. us-ashburn-1).
# Requisitos: OCI CLI configurado (~/.oci/config), jq, región suscrita y en estado READY.
#
# Uso rápido (después de suscribir us-ashburn-1 en consola):
#   export OCI_REGION=us-ashburn-1
#   export OCI_SSH_PUBLIC_KEY_FILE="$HOME/.ssh/oci_design_app_ed25519.pub"
#   ./scripts/provision-oci-vm.sh
#
# Solo comprobar capacidad E2 / A1 en una región:
#   OCI_REGION=us-ashburn-1 ./scripts/provision-oci-vm.sh --check-only
#
# Variables opcionales:
#   OCI_SHAPE=e2|a1          (default e2 = VM.Standard.E2.1.Micro; a1 = Ampere + Ubuntu aarch64)
#   OCI_COMPARTMENT_ID       (default: tenancy = root del ~/.oci/config)
#   OCI_VCN_CIDR             (default 10.70.0.0/16)
#   OCI_SUBNET_CIDR          (default 10.70.0.0/24)
#   OCI_SKIP_NETWORK=1       no crea VCN; usa OCI_SUBNET_ID existente
#   OCI_SUBNET_ID            obligatorio si OCI_SKIP_NETWORK=1

set -euo pipefail

CHECK_ONLY=0
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=1
fi

REGION="${OCI_REGION:-us-ashburn-1}"
SHAPE="${OCI_SHAPE:-e2}"
COMPARTMENT_ID="${OCI_COMPARTMENT_ID:-$(grep '^tenancy=' "${OCI_CONFIG_FILE:-$HOME/.oci/config}" | cut -d= -f2)}"
SSH_KEY_FILE="${OCI_SSH_PUBLIC_KEY_FILE:-$HOME/.ssh/oci_design_app_ed25519.pub}"
VCN_CIDR="${OCI_VCN_CIDR:-10.70.0.0/16}"
SUBNET_CIDR="${OCI_SUBNET_CIDR:-10.70.0.0/24}"
SKIP_NETWORK="${OCI_SKIP_NETWORK:-0}"
EXISTING_SUBNET_ID="${OCI_SUBNET_ID:-}"

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "No existe la clave pública SSH: $SSH_KEY_FILE"
  echo "Exporta OCI_SSH_PUBLIC_KEY_FILE=/ruta/a/tu.pub"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Se necesita jq (brew install jq)."
  exit 1
fi

echo "==> Región: $REGION | Compartment (root): ${COMPARTMENT_ID:0:60}..."

if ! oci iam region-subscription list --tenancy-id "$COMPARTMENT_ID" --output json \
  | jq -e --arg r "$REGION" '.data[] | select(."region-name" == $r and .status == "READY")' >/dev/null 2>&1; then
  echo ""
  echo "ERROR: La región '$REGION' no está suscrita o no está READY."
  echo "Consola OCI → Menú (☰) → Governance & Administration → Region Management →"
  echo "  Add Region → elige p. ej. US East (Ashburn) o US West (Phoenix) → Subscribe."
  echo "Espera a que pase a READY (suele ser 1–5 min) y vuelve a ejecutar este script."
  exit 1
fi

AD="$(oci iam availability-domain list -c "$COMPARTMENT_ID" --region "$REGION" \
  --query 'data[0].name' --raw-output)"
echo "==> Primer AD: $AD"

echo "==> Informe de capacidad (no reserva nada):"
oci compute compute-capacity-report create -c "$COMPARTMENT_ID" --region "$REGION" \
  --availability-domain "$AD" \
  --shape-availabilities '[{"instanceShape":"VM.Standard.E2.1.Micro"}]' \
  --query 'data."shape-availabilities"[0].{shape:"instance-shape",status:"availability-status"}' \
  --output table 2>/dev/null || true

oci compute compute-capacity-report create -c "$COMPARTMENT_ID" --region "$REGION" \
  --availability-domain "$AD" \
  --shape-availabilities '[{"instanceShape":"VM.Standard.A1.Flex","instanceShapeConfig":{"ocpus":1.0,"memoryInGBs":6.0}}]' \
  --query 'data."shape-availabilities"[0].{shape:"instance-shape",status:"availability-status"}' \
  --output table 2>/dev/null || true

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "Modo --check-only: no se crean recursos."
  exit 0
fi

if [[ "$SKIP_NETWORK" != "1" ]]; then
  DNS_LABEL="dsg$(openssl rand -hex 3 | head -c 6)"
  SUB_DNS="ps$(openssl rand -hex 2 | head -c 4)"

  echo "==> Creando VCN ($VCN_CIDR)..."
  VCN_ID="$(oci network vcn create \
    --compartment-id "$COMPARTMENT_ID" \
    --region "$REGION" \
    --cidr-blocks "[\"$VCN_CIDR\"]" \
    --display-name "vcn-design-app-${REGION}" \
    --dns-label "$DNS_LABEL" \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"

  echo "==> Internet Gateway..."
  IGW_ID="$(oci network internet-gateway create \
    --compartment-id "$COMPARTMENT_ID" \
    --region "$REGION" \
    --vcn-id "$VCN_ID" \
    --display-name "ig-design-app" \
    --is-enabled true \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"

  RT_ID="$(oci network route-table list -c "$COMPARTMENT_ID" --region "$REGION" \
    --vcn-id "$VCN_ID" --query 'data[0].id' --raw-output)"
  RULES="$(oci network route-table get --rt-id "$RT_ID" --region "$REGION" \
    --query 'data."route-rules"' --raw-output)"
  NEW_RULES="$(echo "$RULES" | jq --arg igw "$IGW_ID" \
    '. + [{"destination":"0.0.0.0/0","destinationType":"CIDR_BLOCK","networkEntityId":$igw}]')"
  oci network route-table update --rt-id "$RT_ID" --region "$REGION" \
    --route-rules "$NEW_RULES" --force --wait-for-state AVAILABLE >/dev/null

  SL_ID="$(oci network security-list list -c "$COMPARTMENT_ID" --region "$REGION" \
    --vcn-id "$VCN_ID" --query 'data[0].id' --raw-output)"
  INGRESS="$(oci network security-list get --security-list-id "$SL_ID" --region "$REGION" \
    --query 'data."ingress-security-rules"' --raw-output)"
  NEW_INGRESS="$(echo "$INGRESS" | jq '. + [
    {"protocol":"6","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},
    {"protocol":"6","source":"0.0.0.0/0","sourceType":"CIDR_BLOCK","tcpOptions":{"destinationPortRange":{"min":443,"max":443}}}
  ]')"
  oci network security-list update --security-list-id "$SL_ID" --region "$REGION" \
    --ingress-security-rules "$NEW_INGRESS" --force >/dev/null

  echo "==> Subnet regional pública ($SUBNET_CIDR)..."
  SUBNET_ID="$(oci network subnet create \
    --compartment-id "$COMPARTMENT_ID" \
    --region "$REGION" \
    --vcn-id "$VCN_ID" \
    --cidr-block "$SUBNET_CIDR" \
    --display-name "public-sn-design" \
    --dns-label "$SUB_DNS" \
    --prohibit-public-ip-on-vnic false \
    --wait-for-state AVAILABLE \
    --query 'data.id' --raw-output)"
else
  if [[ -z "$EXISTING_SUBNET_ID" ]]; then
    echo "Con OCI_SKIP_NETWORK=1 debes definir OCI_SUBNET_ID."
    exit 1
  fi
  SUBNET_ID="$EXISTING_SUBNET_ID"
  echo "==> Usando subnet existente: $SUBNET_ID"
fi

SHAPE_LC="$(echo "$SHAPE" | tr '[:upper:]' '[:lower:]')"
if [[ "$SHAPE_LC" == "a1" ]]; then
  SHAPE_NAME="VM.Standard.A1.Flex"
  SHAPE_CFG='{"ocpus":1.0,"memoryInGBs":6.0}'
  IMAGE_ID="$(oci compute image list -c "$COMPARTMENT_ID" --region "$REGION" \
    --operating-system "Canonical Ubuntu" --operating-system-version "22.04" \
    --shape "$SHAPE_NAME" \
    --query 'data[0].id' --raw-output)"
  echo "==> Lanzando instancia (Ampere A1, Ubuntu 22.04 aarch64)..."
  INSTANCE_ID="$(oci compute instance launch \
    -c "$COMPARTMENT_ID" \
    --region "$REGION" \
    --availability-domain "$AD" \
    --display-name "design-app-$(date +%Y%m%d-%H%M)" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_ID" \
    --shape "$SHAPE_NAME" \
    --shape-config "$SHAPE_CFG" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "$SSH_KEY_FILE" \
    --wait-for-state RUNNING \
    --query 'data.id' --raw-output)"
else
  SHAPE_NAME="VM.Standard.E2.1.Micro"
  IMAGE_ID="$(oci compute image list -c "$COMPARTMENT_ID" --region "$REGION" \
    --operating-system "Canonical Ubuntu" --operating-system-version "22.04" \
    --shape "$SHAPE_NAME" \
    --query 'data[0].id' --raw-output)"
  echo "==> Lanzando instancia (E2.1.Micro, Ubuntu 22.04 x86)..."
  INSTANCE_ID="$(oci compute instance launch \
    -c "$COMPARTMENT_ID" \
    --region "$REGION" \
    --availability-domain "$AD" \
    --display-name "design-app-$(date +%Y%m%d-%H%M)" \
    --image-id "$IMAGE_ID" \
    --subnet-id "$SUBNET_ID" \
    --shape "$SHAPE_NAME" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "$SSH_KEY_FILE" \
    --wait-for-state RUNNING \
    --query 'data.id' --raw-output)"
fi

echo "==> Instancia: $INSTANCE_ID"
echo "==> Esperando IP pública..."
sleep 15
PUB="$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --region "$REGION" \
  --query 'data[0]."public-ip"' --raw-output)"
echo ""
echo "Listo. IP pública: $PUB"
echo "SSH: ssh -i ~/.ssh/oci_design_app_ed25519 ubuntu@$PUB"
echo ""
echo "IDs útiles (guárdalos):"
echo "  SUBNET_ID=$SUBNET_ID"
[[ "${SKIP_NETWORK:-0}" != "1" ]] && echo "  VCN_ID=$VCN_ID"
