#!/bin/bash
systemctl stop blobt_agent
systemctl enable blobt_agent
systemctl start blobt_agent