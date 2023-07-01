# About
This is a self-hosted application that allows you to transfer BLOBs through a public service (**BLOB Tunnel**) between a client (Web-Browser, or any) and a service running privately (**BLOB Tunnel Agent**). The tool is based on WS and HTTP communication, and have currently 2 ways of transfers:
- Download ( **Agent** --*WS*-- **Tunnel** --*HTTP*-> **Client**)
- Upload ( **Agent** --*WS*-- **Tunnel** --*WS*-- **Client**)
## Story
This tool was made for my side hustle project [ethuardo.com](https://ethuardo.com/), and it aimed to transfer only big content of clients' files. I couldn't let BLOBs flow through the Cloudflare tunnel, because that would violate their free terms of use. I didn't want to also pay for and look for new tunneling services, so I decided to make use of my already paid hosting and deploy there my tunneling application.
## Videos presenting performance:
- [Upload](https://dataram57.com/static-imgs/KLUSNS1DVJ.mp4)
- [Download - OLD](https://dataram57.com/static-imgs/X18AXM04VB.mp4)

[comment]: <> (# Installation)
[comment]: <> (## Tunnel)
[comment]: <> (## Agent)
[comment]: <> (## Client)
[comment]: <> (### Upload)
