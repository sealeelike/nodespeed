# NodeSpeed

## What is this
This is a service combo that helps measure the network quality between a client and your remote VPS. It contains:
1. an interactive script that helps you quickly set up the Cloudflare speedtest kernel on your server
2. a web panel for clients, just like speed.cloudflare.com

## Why this
- Compared with [librespeed](https://github.com/librespeed), this project leverages the Cloudflare speedtest kernel and provides more comprehensive speedtest metrics.
- Compared with [als](https://github.com/wikihost-opensource/als), this project does not require clients to run any commands like iperf3 or mtr, while remaining just as professional.
- Compared with the [official Cloudflare speedtest](https://speed.cloudflare.com), this project does not measure the network quality between clients and Cloudflare nodes, but between clients and the VPS hosted by you.


## Requirements

- A host for the central panel: Docker (Cloudflare Pages mode is not supported yet).
- One or more nodes — your own VPS(es), each with a valid SSL certificate.

## Quick Start

Run this on each node (VPS) as root to install the speedtest agent:

```sh
bash <(curl -Ls https://raw.githubusercontent.com/sealeelike/nodespeed/main/scripts/install.sh)
```

...

## TODO
- [ ] make the central panel available on Cloudflare Pages
- [ ] support packet loss test
- [ ] support single node mode. The speedtest node itself provides the web panel. best for temporary use or beginners.
