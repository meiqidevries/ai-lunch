/* AI lunch · settings
 *
 * channels: the relay servers ("routes") for live sessions. Every message goes out on all of them,
 * and every device listens on all of them, so the session keeps running when some are down,
 * blocked on a network, or busy. Two working routes are plenty; the rest is spare.
 *  - mqtt: free public MQTT brokers over a secure WebSocket (EMQX, HiveMQ, Mosquitto, Eclipse)
 *  - ntfy: the public ntfy server; limited to 60 messages in a burst per network address, so on its
 *    own it cannot carry a full room on one office network
 * The landing page has a connection check that tests every route from the current network.
 * Messages are end-to-end encrypted; the relays only see unreadable text.
 */
window.LUNCH_CONFIG = {
  channels: [
    { type: 'mqtt', url: 'wss://broker.emqx.io:8084/mqtt' },
    { type: 'mqtt', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { type: 'mqtt', url: 'wss://test.mosquitto.org:8081' },
    { type: 'mqtt', url: 'wss://mqtt.eclipseprojects.io/mqtt' },
    { type: 'ntfy', url: 'https://ntfy.sh' }
  ]
};
