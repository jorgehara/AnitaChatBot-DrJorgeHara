# Guía Rápida: Tailscale SSH

> **Configuración completada**: 2026-03-23
> **Tailnet**: jorgehara.github (Free)

## Información de Conexión

### Máquinas en el Tailnet

| Máquina | IP Tailscale | Sistema | Rol |
|---------|--------------|---------|-----|
| **capi-pc** | `100.87.181.53` | Windows 11 25H2 | Cliente (esta PC) |
| **jorgeharadevs-hp-laptop-15** | `100.120.226.7` | Linux (Ubuntu 22.04) | Servidor (bot ANITA) |
| motorola-moto-g72 | `100.67.183.31` | Android 13 | Exit Node |
| tailscale-ssh-console | `100.64.202.31` | JS/Web | Consola SSH web efímera |

---

## Conectarse al Servidor (HP Laptop)

### Desde PowerShell/CMD/Terminal en Windows:

```bash
ssh jorgeharadevs@100.120.226.7
```

**Usuario**: `jorgeharadevs`  
**IP Tailscale**: `100.120.226.7`  
**Home directory**: `/home/jorgeharadevs`

### Primera Conexión

Si es la primera vez que te conectás desde una máquina nueva, Tailscale SSH va a pedirte autorización web:

1. Te va a dar una URL tipo: `https://login.tailscale.com/a/xxxxxxxxx`
2. Abrí esa URL en tu browser
3. Autenticá con GitHub
4. La conexión SSH se va a completar automáticamente

---

## Comandos Útiles de Tailscale

### Ver estado de la red:
```bash
tailscale status
```

### Ver IP de Tailscale:
```bash
tailscale ip
```

### Diagnosticar conectividad:
```bash
tailscale netcheck
```

### Probar conectividad a una máquina:
```bash
ping 100.120.226.7
```

### Desconectar/Reconectar:
```bash
tailscale down
tailscale up
```

### Logout (si necesitás cambiar de cuenta):
```bash
tailscale logout
tailscale login
```

---

## Troubleshooting

### Si `tailscale status` dice "NoState"

1. Abrí PowerShell **como Administrador**
2. Ejecutá:
   ```powershell
   net stop Tailscale
   net start Tailscale
   tailscale up
   ```

### Si la GUI de Windows no muestra conexión

1. Buscá el ícono de Tailscale en la bandeja del sistema (system tray)
2. Click derecho → **Log out**
3. Click derecho → **Log in**
4. Autenticá con GitHub en el browser

### Si SSH falla con "Connection refused"

Verificá que el servidor tenga SSH habilitado en Tailscale:
- Andá a https://login.tailscale.com/admin/machines
- Click en la HP Laptop
- Verificá que **SSH** esté habilitado

---

## Información de Red

- **DERP relay más cercano**: São Paulo (latencia ~55ms)
- **Latencia típica Windows → HP Laptop**: 50-60ms
- **IPv6**: Disponible (nativo en la red local)
- **NAT traversal**: UDP directo funciona correctamente

---

## Dashboard Web

**URL**: https://login.tailscale.com/admin/machines

Desde ahí podés:
- Ver todas las máquinas conectadas
- Usar la SSH Console web (sin instalar nada)
- Configurar ACLs (Access Control Lists)
- Habilitar/deshabilitar SSH
- Ver logs de conexión

---

## Notas Importantes

1. **Tailscale SSH** es más seguro que SSH tradicional (usa tu identidad de GitHub)
2. No necesitás gestionar claves SSH manualmente
3. Las conexiones son peer-to-peer cuando es posible (mejor latencia)
4. Si no hay ruta directa, usa DERP relay (São Paulo en nuestro caso)
5. El firewall de Windows/Linux no bloquea conexiones de Tailscale

---

**Última actualización**: 2026-03-23  
**Documentado por**: Claude (con Jorge)
