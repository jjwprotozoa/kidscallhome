#!/bin/bash
# Cloudflare Page Rules Management Script
# Manages page rules for kidscallhome.com domain

set -e

# Configuration
ZONE_ID="47da5b94667c38fe40fe90419402ac78"
BASE_URL="https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/pagerules"

# Get API token from environment or prompt
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

if [ -z "$API_TOKEN" ]; then
    echo "Error: CLOUDFLARE_API_TOKEN environment variable not set"
    echo "Set it with: export CLOUDFLARE_API_TOKEN='your-token-here'"
    echo "Or get a token from: https://dash.cloudflare.com/profile/api-tokens"
    exit 1
fi

# Default action
ACTION="${1:-list}"
PAGE_RULE_ID="${2:-}"

list_page_rules() {
    echo "Fetching page rules..."
    response=$(curl -s -X GET "$BASE_URL" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" = "true" ]; then
        count=$(echo "$response" | jq -r '.result | length')
        echo ""
        echo "Page Rules Found: $count"
        echo "$response" | jq -r '.result[] | "--- Page Rule: \(.id) ---\nStatus: \(.status)\nPriority: \(.priority)\nTargets: \(.targets[].constraint.value)\nActions: \(.actions[] | "\(.id): \(.value)")\n"'
    else
        echo "Error: $(echo "$response" | jq -r '.errors')"
        exit 1
    fi
}

get_page_rule() {
    if [ -z "$PAGE_RULE_ID" ]; then
        echo "Error: Page rule ID is required for 'get' action"
        echo "Usage: $0 get <page-rule-id>"
        exit 1
    fi
    
    echo "Fetching page rule: $PAGE_RULE_ID..."
    response=$(curl -s -X GET "$BASE_URL/$PAGE_RULE_ID" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" = "true" ]; then
        echo ""
        echo "Page Rule Details:"
        echo "$response" | jq '.result'
    else
        echo "Error: $(echo "$response" | jq -r '.errors')"
        exit 1
    fi
}

create_root_domain_redirect() {
    echo "Creating page rule to redirect kidscallhome.com → www.kidscallhome.com..."
    
    body=$(cat <<EOF
{
  "targets": [
    {
      "target": "url",
      "constraint": {
        "operator": "matches",
        "value": "http://kidscallhome.com/*"
      }
    },
    {
      "target": "url",
      "constraint": {
        "operator": "matches",
        "value": "https://kidscallhome.com/*"
      }
    }
  ],
  "actions": [
    {
      "id": "forwarding_url",
      "value": {
        "url": "https://www.kidscallhome.com/\$1",
        "status_code": 301
      }
    }
  ],
  "priority": 1,
  "status": "active"
}
EOF
)
    
    response=$(curl -s -X POST "$BASE_URL" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$body")
    
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" = "true" ]; then
        rule_id=$(echo "$response" | jq -r '.result.id')
        echo ""
        echo "✅ Page Rule Created Successfully!"
        echo "Rule ID: $rule_id"
        echo ""
        echo "Rule will be active in 1-2 minutes."
        echo "Test with: curl -I http://kidscallhome.com"
    else
        echo "Error: $(echo "$response" | jq -r '.errors')"
        exit 1
    fi
}

delete_page_rule() {
    if [ -z "$PAGE_RULE_ID" ]; then
        echo "Error: Page rule ID is required for 'delete' action"
        echo "Usage: $0 delete <page-rule-id>"
        exit 1
    fi
    
    echo "Deleting page rule: $PAGE_RULE_ID..."
    response=$(curl -s -X DELETE "$BASE_URL/$PAGE_RULE_ID" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")
    
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" = "true" ]; then
        echo "✅ Page Rule Deleted Successfully!"
    else
        echo "Error: $(echo "$response" | jq -r '.errors')"
        exit 1
    fi
}

# Main execution
case "$ACTION" in
    list)
        list_page_rules
        ;;
    get)
        get_page_rule
        ;;
    create)
        create_root_domain_redirect
        ;;
    delete)
        delete_page_rule
        ;;
    *)
        echo "Unknown action: $ACTION"
        echo "Valid actions: list, get, create, delete"
        echo ""
        echo "Usage:"
        echo "  $0 list                    # List all page rules"
        echo "  $0 get <rule-id>           # Get specific page rule"
        echo "  $0 create                  # Create root domain redirect rule"
        echo "  $0 delete <rule-id>        # Delete page rule"
        exit 1
        ;;
esac

