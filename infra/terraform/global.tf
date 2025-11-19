terraform {
  required_version = ">= 1.9.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.35"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
  account_id = var.cloudflare_account_id
}

variable "durable_object_name" {
  type    = string
  default = "intent-router"
}

resource "cloudflare_workers_kv_namespace" "intent_cache" {
  title = "intent-metadata"
}

resource "cloudflare_workers_script" "input_gateway" {
  name    = "edge-input-gateway"
  content = file("${path.module}/../workers/input-gateway.js")

  dependson = [cloudflare_workers_kv_namespace.intent_cache]

  kv_namespace_binding {
    name         = "INTENT_CACHE"
    namespace_id = cloudflare_workers_kv_namespace.intent_cache.id
  }

  durable_object {
    name = "IntentRouter"
    class_name = "IntentRouter"
  }
}

resource "cloudflare_workers_script" "session_orchestrator" {
  name    = "session-orchestrator"
  content = file("${path.module}/../workers/session-orchestrator.js")
}

output "input_gateway_route" {
  description = "Cloudflare worker route handling intent batches"
  value       = cloudflare_workers_script.input_gateway.name
}

