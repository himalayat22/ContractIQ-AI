import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import dns from 'node:dns';

function usesOnlyLocalDns(servers) {
  return servers.length > 0 && servers.every((s) => s === '127.0.0.1' || s === '::1');
}

function getWindowsDnsServers() {
  const output = execSync(
    'powershell -NoProfile -Command "(Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object ServerAddresses).ServerAddresses"',
    { encoding: 'utf8', timeout: 10_000 },
  );

  return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function getUnixDnsServers() {
  try {
    const content = readFileSync('/etc/resolv.conf', 'utf8');
    return content
      .split('\n')
      .filter((line) => line.startsWith('nameserver '))
      .map((line) => line.split(/\s+/)[1])
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Node may use 127.0.0.1 as the only DNS server (Docker/WSL/VPN tools) while the OS
 * resolver still works — that breaks mongodb+srv (querySrv ECONNREFUSED). Sync OS DNS
 * when we detect that misconfiguration.
 */
export function ensureResolvableDns() {
  const current = dns.getServers();
  if (!usesOnlyLocalDns(current)) {
    return;
  }

  const osServers =
    process.platform === 'win32' ? getWindowsDnsServers() : getUnixDnsServers();

  if (osServers.length > 0) {
    dns.setServers(osServers);
  }
}
