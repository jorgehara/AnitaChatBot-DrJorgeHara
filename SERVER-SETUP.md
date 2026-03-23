# Configuración del Servidor - Chatbots

> **Servidor**: jorgeharadevs-HP-Laptop-15-da0xxx  
> **IP Tailscale**: `100.120.226.7`  
> **SSH**: `ssh jorgeharadevs@100.120.226.7`

---

## ⚠️ ORDEN DE INICIO CRÍTICO

**SIEMPRE iniciar en este orden**:
1. **PRIMERO**: Chatbot Odontóloga (puertos 3010/3011)
2. **SEGUNDO**: Chatbot CharlyBot (puertos 3008/3009)

---

## Chatbots en el Servidor

### 🦷 Chatbot Odontóloga Villalba (ESTE PROYECTO)

- **Ruta**: `~/Desktop/AnitaChatBot-Odontologia/`
- **Puertos**: 
  - Bot: `3010`
  - Express: `3011`
- **PM2 name**: `chatbot-odontologa`
- **Estado**: ✅ **FUNCIONANDO** (Fixed: 2026-03-23)

### 👨‍⚕️ Chatbot Dr. Kulinka (CharlyBot)

- **Ruta**: `~/Desktop/AnitaByCitaMedica/`
- **Puertos**: 
  - Bot: `3008`
  - Express: `3009`
- **PM2 name**: `restart-server`
- **Estado**: ✅ Funciona bien (meses sin caídas)

---

## Comandos de Gestión

### Iniciar Chatbot Odontóloga (PRIMERO)

```bash
cd ~/Desktop/AnitaChatBot-Odontologia/
pm2 start restart-server.sh --interpreter bash --name chatbot-odontologa
pm2 logs chatbot-odontologa
pm2 status
pm2 startup
pm2 save
```

### Iniciar Chatbot CharlyBot (SEGUNDO)

```bash
cd ~/Desktop/AnitaByCitaMedica/
pm2 start restart-server.sh --interpreter bash --name restart-server
pm2 logs restart-server 
pm2 status
pm2 startup
pm2 save
```

### Detener un Chatbot

```bash
pm2 stop chatbot-odontologa    # Odontóloga
pm2 stop restart-server        # CharlyBot
```

### Reiniciar un Chatbot

```bash
pm2 restart chatbot-odontologa    # Odontóloga
pm2 restart restart-server        # CharlyBot
```

### Ver Logs en Tiempo Real

```bash
pm2 logs chatbot-odontologa    # Odontóloga
pm2 logs restart-server        # CharlyBot
pm2 logs                       # Ambos
```

### Ver Estado de Todos los Procesos

```bash
pm2 status
pm2 monit    # Vista en tiempo real con recursos
```

### Limpiar Logs

```bash
pm2 flush
```

### Eliminar un Proceso de PM2

```bash
pm2 delete chatbot-odontologa    # Odontóloga
pm2 delete restart-server        # CharlyBot
```

---

## Script restart-server.sh

Ambos bots usan un script que:
- **Reinicia automáticamente cada 10 minutos** (por diseño)
- Libera puertos antes de cada reinicio
- Detecta errores y reinicia inmediatamente si encuentra problemas

**Esto NO es un bug**, es el comportamiento esperado para mantener los bots estables.

---

## Troubleshooting

### Ver si hay procesos huérfanos ocupando puertos

```bash
# Ver qué está usando los puertos
lsof -i :3010
lsof -i :3011
lsof -i :3008
lsof -i :3009

# Matar proceso en un puerto específico
fuser -k 3010/tcp
fuser -k 3011/tcp
```

### Limpiar todo y empezar de cero

```bash
# Detener todos los procesos PM2
pm2 stop all
pm2 delete all

# Matar procesos huérfanos de Node.js
pkill -f "AnitaChatBot-Odontologia"
pkill -f "AnitaByCitaMedica"

# Verificar que no quede nada
ps aux | grep node | grep -v grep

# Reiniciar en orden correcto
cd ~/Desktop/AnitaChatBot-Odontologia/
pm2 start restart-server.sh --interpreter bash --name chatbot-odontologa

cd ~/Desktop/AnitaByCitaMedica/
pm2 start restart-server.sh --interpreter bash --name restart-server
```

### Ver puertos en uso

```bash
netstat -tulpn | grep -E ':(3008|3009|3010|3011)'
```

---

## Notas Importantes

1. **CharlyBot funciona bien** → NO tocarlo a menos que sea necesario
2. **Odontóloga ARREGLADO** ✅ (2026-03-23: Fix EMFILE + Node.js v20)
3. El reinicio cada 10 minutos es **intencional**, no un bug
4. Siempre usar PM2, nunca `npm run dev` directo
5. Cada bot tiene su propio `.env` y configuración
6. Los bots usan MongoDB (verificar conexión si hay problemas)

---

## 🐛 Problemas Resueltos (2026-03-23)

### Error EMFILE: too many open files

**Síntoma**: Nodemon crasheaba con "EMFILE: too many open files"

**Causa**: Límite de file descriptors (1024) muy bajo para reincios frecuentes

**Solución**: Agregado `ulimit -n 65536` al inicio de `restart-server.sh`

### Error TypeError: globalThis.crypto undefined

**Síntoma**: 
```
TypeError: Cannot destructure property 'subtle' of 'globalThis.crypto' as it is undefined.
Node.js v18.19.1
```

**Causa**: Baileys requiere Node.js 20+ para la API `globalThis.crypto`, pero el bot usaba Node v18 del sistema

**Solución**: Agregado carga de NVM al inicio de `restart-server.sh`:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20
ulimit -n 65536
```

**Backup**: `restart-server.sh.backup` contiene el script original

---

**Última actualización**: 2026-03-23  
**Documentado por**: Claude (con Jorge)
