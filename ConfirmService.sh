#!/bin/bash
systemctl stop blobt_agent
chmod +x "blobt_agent.service"
cp "blobt_agent.service" "/etc/systemd/system"
systemctl daemon-reload