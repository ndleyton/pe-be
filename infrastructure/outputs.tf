output "server_ipv4" {
  description = "The IPv4 address of the server"
  value       = hcloud_server.web_server.ipv4_address
}

output "server_ipv6" {
  description = "The IPv6 address of the server"
  value       = hcloud_server.web_server.ipv6_address
}

output "server_status" {
  description = "The status of the server"
  value       = hcloud_server.web_server.status
}
