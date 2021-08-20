# Inform that you will need the Cloudflare Workers CLI, "wrangler"
echo 'You will need the Cloudflare Workers CLI, "wrangler", for the following steps...'

# Create KV namespace
wrangler kv:namespace create "TOGGLES_CACHE"