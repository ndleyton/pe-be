# Infrastructure as Code (Terraform)

This directory contains the Terraform configuration for managing the Hetzner Cloud infrastructure for this project.

## Prerequisites

1. **Terraform**: [Install Terraform](https://developer.hashicorp.com/terraform/downloads).
2. **Hetzner Cloud API Token**: You will need an API token from your Hetzner Cloud Console.
   - Go to your project in the Hetzner Cloud Console.
   - Go to **Security** > **API Tokens**.
   - Create a new token with **Read & Write** permissions.
3. **SSH Key**: An SSH public key that you will use to connect to the VPS.

## Configuration

We pass sensitive configuration via environment variables or a `.tfvars` file. Using environment variables is the easiest for local development without risking committing secrets.

Set the following environment variables in your terminal before running Terraform commands:

```bash
# Your Hetzner API token
export TF_VAR_hcloud_token="your-hetzner-api-token"

# Your public SSH key content
export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_ed25519.pub)"
```

Alternatively, create an `terraform.tfvars` file (which is ignored by Git by default, but make sure it is added to `.gitignore`):

```hcl
hcloud_token   = "your-hetzner-api-token"
ssh_public_key = "ssh-ed25519 AAAAC3NzaC... user@hostname"
```

## Usage

1. **Initialize Terraform:**

   Downloads the required provider plugins (like the Hetzner Cloud provider).

   ```bash
   terraform init
   ```

2. **Format and Validate (Optional):**

   Check that the configuration is valid and correctly formatted.

   ```bash
   terraform fmt
   terraform validate
   ```

3. **Plan the changes:**

   Preview what Terraform is going to create or modify.

   ```bash
   terraform plan
   ```

4. **Apply the changes:**

   Execute the plan to create or modify the infrastructure.

   ```bash
   terraform apply
   ```

5. **Destroy the infrastructure:**

   **Warning:** This will delete your VPS and all data on it!

   ```bash
   terraform destroy
   ```

## Next Steps

Right now, this manages the Hetzner Server, SSH keys, and basic Firewall rules. Because our app relies on the existing VPS state and data, if you apply this in a new Hetzner project it will create a fresh server.

To adopt an **existing** Hetzner server into this Terraform state rather than creating a new one, you will need to import the resources:

```bash
# Example: Import an existing server (replace <SERVER_ID> with the ID from Hetzner console)
terraform import hcloud_server.web_server <SERVER_ID>

# Import existing firewall
terraform import hcloud_firewall.web_and_ssh <FIREWALL_ID>
```
