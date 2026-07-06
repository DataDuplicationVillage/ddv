#!/usr/bin/env bash
set -euo pipefail

if [ -z "${WSL_DISTRO_NAME:-}" ]; then
  echo "scripts/vagrant-rsync-wsl.sh is only needed when running Vagrant from WSL." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
key_file="${repo_root}/.vagrant/machines/default/virtualbox/private_key"

if [ ! -f "${key_file}" ]; then
  echo "Vagrant private key not found at ${key_file}. Run vagrant up first." >&2
  exit 1
fi

proxy_script="${repo_root}/scripts/wsl-tcp-proxy.ps1"
proxy_script="${proxy_script#/}"
proxy_script="${proxy_script//\//\\}"
windows_proxy_script="\\\\wsl.localhost\\${WSL_DISTRO_NAME}\\${proxy_script}"

proxy_wrapper="$(mktemp)"
trap 'rm -f "${proxy_wrapper}"' EXIT

cat >"${proxy_wrapper}" <<EOF
#!/usr/bin/env bash
exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File '${windows_proxy_script}' 127.0.0.1 2222
EOF

chmod +x "${proxy_wrapper}"

ssh_opts=(
  -o StrictHostKeyChecking=no
  -o UserKnownHostsFile=/dev/null
  -o ProxyCommand="${proxy_wrapper}"
  -i "${key_file}"
)

ssh "${ssh_opts[@]}" vagrant@127.0.0.1 'sudo mkdir -p /vagrant && sudo chown vagrant:vagrant /vagrant'

rsync -az --delete \
  --exclude '.git/' \
  --exclude '.vagrant/' \
  --exclude 'venv/' \
  --exclude '**/__pycache__/' \
  --exclude 'ddv-drive-tracker/node_modules/' \
  --exclude 'ddv-drive-tracker/dist/' \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand=${proxy_wrapper} -i ${key_file}" \
  "${repo_root}/" \
  vagrant@127.0.0.1:/vagrant/
