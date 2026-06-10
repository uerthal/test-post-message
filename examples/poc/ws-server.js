const { WebSocketServer } = require("ws");

const port = Number(process.env.WS_PORT || 8081);
const wss = new WebSocketServer({ port });

function safeParse(rawMessage) {
  try {
    return JSON.parse(rawMessage);
  } catch (error) {
    return null;
  }
}

function sendJson(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcastToOthers(sender, payload) {
  for (const client of wss.clients) {
    if (client !== sender) {
      sendJson(client, payload);
    }
  }
}

wss.on("connection", (socket) => {
  sendJson(socket, {
    type: "SERVER_READY",
    payload: {
      connectedClients: wss.clients.size
    },
    meta: {
      source: "ws-server",
      sentAt: new Date().toISOString()
    }
  });

  socket.on("message", (rawMessage) => {
    const parsedMessage = safeParse(rawMessage.toString());

    if (!parsedMessage || !parsedMessage.type) {
      sendJson(socket, {
        type: "SERVER_ERROR",
        payload: {
          message: "Mensaje invalido recibido por el servidor."
        },
        meta: {
          source: "ws-server",
          sentAt: new Date().toISOString()
        }
      });
      return;
    }

    const messageToBroadcast = {
      ...parsedMessage,
      meta: {
        ...parsedMessage.meta,
        serverReceivedAt: new Date().toISOString()
      }
    };

    broadcastToOthers(socket, messageToBroadcast);
  });
});

console.log("WebSocket server escuchando en ws://127.0.0.1:" + port);
