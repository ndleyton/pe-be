variable "hcloud_token" {
  type        = string
  description = "Hetzner Cloud API Token"
  sensitive   = true
}

variable "ssh_public_key" {
  type        = string
  description = "The SSH public key to add to the server for access"
}

variable "server_name" {
  type        = string
  description = "The name of the Hetzner server"
  default     = "pe-be-prod"
}

variable "server_type" {
  type        = string
  description = "The server type (e.g., cx22, cpx11, cpx21)"
  default     = "cx22"
}

variable "location" {
  type        = string
  description = "The datacenter location (e.g., nbg1, fsn1, hel1, ash)"
  default     = "fsn1"
}

variable "image" {
  type        = string
  description = "The OS image for the server"
  default     = "ubuntu-24.04"
}
