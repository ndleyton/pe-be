# Infrastructure as Code (Terraform)

This directory contains a Terraform representation of the project's current Hetzner
Cloud architecture: a VPS, a cloud firewall, and an SSH key. It is included as
portfolio documentation and a starting point for possible future infrastructure
management.

## Current status

The project is running successfully in production on the existing VPS. **This
Terraform configuration is not currently used to provision or manage that
infrastructure, or to deploy the application.** The existing infrastructure was
set up outside Terraform; backend deployment uses the manually dispatched
[GitHub Actions workflow](../.github/workflows/deploy-vps.yml), SSH, and Docker
Compose. The frontend deploys separately through Render's Git integration.

This configuration represents the architecture, not a verified Terraform inventory
of the live resources. Its example defaults must be reconciled with the existing
VPS before adoption. The setup, shared-state, import, and rotation procedures below
are prerequisites for future Terraform use, not steps in the current application
deployment process.

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

## Production ownership and state

This module would use **local state** if initialized. It does not configure a shared backend.
Do not run a production apply from a fresh checkout or an empty state: Terraform
can create a second server even when `prevent_destroy` protects the original.

Before production use, record an authoritative inventory in the team's restricted
operations record: Hetzner project, server ID/IP, firewall ID and attachments, SSH
key ID/fingerprint, state location and workspace, responsible operator, and backup
recovery location. One resource must belong to only one Terraform state.

Choose and record one ownership model before importing:

- A shared backend with locking, restricted access, versioning, and recoverable
  state backups. Configure the selected backend, migrate any existing state with
  `terraform init -migrate-state`, and verify `terraform state list` and resource
  IDs before planning. Do not start a separate inventory in the new backend.
- Until that is available, one designated operator and one authoritative checkout
  may perform imports/applies. Other checkouts must not manage production. Back up
  the state securely after each import/apply. Handoff requires stopping the old
  writer, securely transferring the latest state and configuration, verifying IDs,
  and recording the new owner before any writes resume.

Local locking only coordinates processes using the same state. Never use
`-lock=false` or force-unlock a live operation. If state is lost, stop applies,
recover its latest backup or reconcile all resources through imports; do not apply
an empty state. Do not commit state, saved plans, or credentials to Git. Commit the
provider dependency lock file after initialization and review provider upgrades.

## Adopt the existing production host

1. Confirm the ownership/state procedure above. Check `terraform state list` first;
   do not import resources already tracked here or in another state.
2. Take and verify an off-host database backup and backups of the media volumes and
   runtime configuration. The [backup runbook](../backend/deploy/backups/README.md)
   covers database backup and restore checks. A database dump does not include media.
3. Record the existing server name, type, location, image, network settings,
   firewall rules/attachments, and cloud SSH key name/public key. Match the Terraform
   variables and resource configuration to that inventory before planning. Defaults
   here are examples, not verified production values. Preserve every existing
   firewall attachment and rule during adoption, including administrative access.
4. Initialize and import **all three** existing resources into the chosen state,
   using their actual IDs. Run from this directory. Skip only resources already
   correctly tracked in this state:

   ```bash
   terraform init
   terraform import hcloud_ssh_key.default <SSH_KEY_ID>
   terraform import hcloud_firewall.web_and_ssh <FIREWALL_ID>
   terraform import hcloud_server.web_server <SERVER_ID>
   terraform state list
   terraform fmt -check
   terraform validate
   terraform plan
   ```

   If the matching cloud SSH key or firewall does not exist, stop and document a
   separate creation/attachment change. A cloud key import does not prove that key
   is authorized for the live `deploy` user.
5. Review the full plan against the recorded IDs. Initial adoption should have no
   unexpected changes; enabling deletion/rebuild protection is expected if absent.
   Stop on any create, replacement, deletion, network change, or access change.
   Reconcile configuration instead of disabling safeguards to make the plan pass.
6. Once reviewed, save a plan to a restricted location outside the checkout,
   inspect it with `terraform show`, and apply that exact plan during a maintenance
   window. Verify server identity/IP, SSH in a fresh session, firewall attachments,
   and origin/public API readiness afterward. Securely back up the resulting state.

## SSH key rotation and server replacement

The server ignores changes to the creation-time `ssh_keys` attribute. This avoids
replacement when an imported server lacks that association or the cloud key
changes. It also means Terraform does **not** rotate live SSH access. The provider
[v1.45.0 server schema](https://github.com/hetznercloud/terraform-provider-hcloud/blob/v1.45.0/internal/server/resource.go)
marks `ssh_keys`, `image`, and `location` as replacement-triggering fields; review
the resolved provider version and actual plan as well.

For a live key rotation, keep a working administrative session and console/recovery
access. Add the new public key to the intended host user's `authorized_keys`, test
it from a second session (including required deployment privileges), update the CI
SSH credential, and verify access before removing the old host key authorization.
Manage the cloud key inventory separately: editing a cloud key does not update the
running host's `authorized_keys`. Keep the recorded fingerprints current.

`prevent_destroy` rejects planned server replacement/destruction while this resource
block remains present. It cannot prevent duplicate creation from empty state or
protect a resource whose configuration block is removed. Cloud deletion/rebuild
protection only takes effect after a reviewed apply; it is not proof that the live
server is already protected.

Do not use routine `terraform destroy` for production. A deliberate replacement
requires a separate maintenance/migration plan covering restored database and media,
configuration and systemd jobs, tested administrative access, traffic cutover,
rollback, and explicit approval before retiring the old host or removing protection.
