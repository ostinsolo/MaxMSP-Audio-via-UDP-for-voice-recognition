/*
 * =======================================================================
 * NETWORK PROTOCOLS vs SERIAL COMMUNICATION - COMPARISON
 * =======================================================================
 * 
 * This file implements SERIAL communication protocol.
 * 
 * COMMUNICATION PROTOCOL COMPARISON:
 * 
 * TCP (Transmission Control Protocol):
 * ✅ Network-based, connection-oriented, reliable
 * ✅ Guarantees data delivery and order
 * ❌ Higher overhead, slower for real-time applications
 * 
 * UDP (User Datagram Protocol):  
 * ✅ Network-based, connectionless, fast
 * ✅ Low latency, ideal for real-time audio streaming
 * ❌ No delivery guarantee, packets can be lost
 * 
 * SERIAL (RS-232, USB, etc.):
 * ✅ Direct hardware connection, reliable
 * ✅ Simple protocol, good for device control
 * ✅ Built-in flow control and error detection
 * ❌ Point-to-point only (no broadcasting)
 * ❌ Limited by cable length and speed
 * ❌ Requires physical connection
 * 
 * THIS FILE (SERIAL): Implements serial communication for direct hardware
 * control and data exchange. Good for connecting physical devices, sensors,
 * or controllers that don't support network protocols.
 * =======================================================================
 */

const maxApi = require('max-api');
const { SerialPort } = require('serialport');

let port;
let buffer = Buffer.alloc(0);

maxApi.addHandler('listPorts', async () => {
    try {
        const ports = await SerialPort.list();
        maxApi.post('Available ports:');
        ports.forEach((port, index) => {
            maxApi.post(`${index}: ${port.path} (${port.manufacturer || 'Unknown manufacturer'})`);
        });
    } catch (err) {
        maxApi.post(`Error listing ports: ${err.message}`);
    }
});

maxApi.addHandler('openPort', async (portName) => {
    try {
        if (!portName) {
            maxApi.post('Error: No port name provided. Use "listPorts" to see available ports.');
            return;
        }

        port = new SerialPort({ path: portName, baudRate: 9600 });
        
        port.on('open', () => {
            maxApi.post(`Port ${portName} opened successfully`);
        });

        port.on('error', (err) => {
            maxApi.post(`Port error: ${err.message}`);
        });

        port.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);
            while (buffer.length >= 4) {
                const value = buffer.readFloatLE(0);
                maxApi.outlet(value);
                buffer = buffer.slice(4);
            }
        });

    } catch (err) {
        maxApi.post(`Failed to open port: ${err.message}`);
    }
});

maxApi.addHandler('closePort', () => {
    if (port && port.isOpen) {
        port.close((err) => {
            if (err) {
                maxApi.post(`Error closing port: ${err.message}`);
            } else {
                maxApi.post('Port closed');
            }
        });
    } else {
        maxApi.post('No port is currently open');
    }
});