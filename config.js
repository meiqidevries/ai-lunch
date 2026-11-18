/* AI lunch · settings
 *
 * channels: the relay servers for live sessions. Every message goes out on all of them, and every
 * device listens on all of them, so the session keeps running when one is slow, blocked or busy.
 *  - mqtt: public MQTT brokers over a secure WebSocket (Eclipse on port 443, EMQX on port 8084)
 *  - ntfy: the public ntfy server (port 443); limited to 60 messages in a burst per network address
 * Messages are end-to-end encrypted; the relays only see unreadable text.
 */
window.LUNCH_CONFIG = {
  channels: [
    { type: 'mqtt', url: 'wss://mqtt.eclipseprojects.io/mqtt' },
    { type: 'mqtt', url: 'wss://broker.emqx.io:8084/mqtt' },
    { type: 'ntfy', url: 'https://ntfy.sh' }
  ]
};
