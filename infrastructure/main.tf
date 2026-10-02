terraform {
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.45"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

# SSH Key for Server Access
resource "hcloud_ssh_key" "default" {
  name       = "deploy-key"
  public_key = var.ssh_public_key
}

# Firewall to allow web and SSH traffic
resource "hcloud_firewall" "web_and_ssh" {
  name = "web-and-ssh-firewall"

  # Allow inbound SSH
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "22"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  # Allow inbound HTTP
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "80"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }

  # Allow inbound HTTPS
  rule {
    direction  = "in"
    protocol   = "tcp"
    port       = "443"
    source_ips = [
      "0.0.0.0/0",
      "::/0"
    ]
  }
}

# The VPS Server Instance
resource "hcloud_server" "web_server" {
  name        = var.server_name
  image       = var.image
  server_type = var.server_type
  location    = var.location
  ssh_keys    = [hcloud_ssh_key.default.id]
  firewall_ids = [hcloud_firewall.web_and_ssh.id]
  
  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }
}
