require "shellwords"

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.hostname = "ddv-runtime"

  config.vm.network "forwarded_port", guest: 8000, host: 8000, auto_correct: true
  config.vm.network "forwarded_port", guest: 3000, host: 3000, auto_correct: true

  if ENV["WSL_DISTRO_NAME"]
    proxy_script = File.expand_path("scripts/wsl-tcp-proxy.ps1", __dir__)
    windows_proxy_script = "\\\\wsl.localhost\\#{ENV["WSL_DISTRO_NAME"]}\\#{proxy_script.delete_prefix("/").tr("/", "\\")}"

    config.vm.boot_timeout = 1200
    config.ssh.host = "127.0.0.1"
    config.ssh.proxy_command = [
      "powershell.exe",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      windows_proxy_script,
      "127.0.0.1",
      "2222"
    ].shelljoin

    config.vm.network "forwarded_port",
                      guest: 22,
                      host: 2222,
                      id: "ssh",
                      host_ip: "127.0.0.1"

    config.vm.synced_folder File.expand_path(".", __dir__), "/vagrant",
                            type: "rsync",
                            disabled: false,
                            rsync__auto: true,
                            rsync__exclude: [
                              ".git/",
                              ".vagrant/",
                              "venv/",
                              "**/__pycache__/",
                              "ddv-drive-tracker/node_modules/",
                              "ddv-drive-tracker/dist/"
                            ]

    config.trigger.before :provision do |trigger|
      trigger.name = "Sync WSL project files"
      trigger.info = "Syncing WSL project files into /vagrant..."
      trigger.run = { inline: "scripts/vagrant-rsync-wsl.sh" }
    end
  else
    config.vm.synced_folder ".", "/vagrant"
  end

  config.vm.provider "virtualbox" do |vb|
    vb.name = "ddv-runtime"
    vb.cpus = 2
    vb.memory = 4096
    vb.customize ["modifyvm", :id, "--uart1", "off"] if ENV["WSL_DISTRO_NAME"]
  end

  config.vm.provision "shell", path: "scripts/provision-vagrant.sh"
end
