(function (global) {
  "use strict";

  function createClientId(appName) {
    const safeAppName = String(appName || "app")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return safeAppName + "-" + Math.random().toString(36).slice(2, 10);
  }

  function parseJson(rawMessage) {
    try {
      return JSON.parse(rawMessage);
    } catch (error) {
      return null;
    }
  }

  function SessionSyncClient(config) {
    if (!config || !config.wsUrl || !config.appName) {
      throw new Error("SessionSyncClient requiere wsUrl y appName.");
    }

    this.wsUrl = config.wsUrl;
    this.appName = config.appName;
    this.clientId = config.clientId || createClientId(config.appName);
    this.autoReconnect = config.autoReconnect !== false;
    this.reconnectDelayMs = config.reconnectDelayMs || 1500;
    this.maxReconnectDelayMs = config.maxReconnectDelayMs || 10000;
    this.currentReconnectDelayMs = this.reconnectDelayMs;
    this.getCurrentUser = typeof config.getCurrentUser === "function"
      ? config.getCurrentUser
      : function () {
          return null;
        };

    this.listeners = new Map();
    this.socket = null;
    this.destroyed = false;
    this.manuallyClosed = false;
    this.reconnectTimer = null;
  }

  SessionSyncClient.prototype.on = function (eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(handler);

    return () => {
      const handlers = this.listeners.get(eventType);

      if (handlers) {
        handlers.delete(handler);
      }
    };
  };

  SessionSyncClient.prototype.emitLocal = function (eventType, payload) {
    const exactHandlers = this.listeners.get(eventType) || new Set();
    const anyHandlers = this.listeners.get("*") || new Set();

    for (const handler of exactHandlers) {
      handler(payload);
    }

    for (const handler of anyHandlers) {
      handler(payload);
    }
  };

  SessionSyncClient.prototype.safeGetCurrentUser = function () {
    try {
      return this.getCurrentUser() || null;
    } catch (error) {
      this.emitLocal("ERROR", {
        type: "ERROR",
        message: "No se pudo obtener el usuario actual.",
        details: error
      });
      return null;
    }
  };

  SessionSyncClient.prototype.connect = function () {
    if (this.destroyed) {
      return;
    }

    this.manuallyClosed = false;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.socket = new WebSocket(this.wsUrl);
    } catch (error) {
      this.emitLocal("ERROR", {
        type: "ERROR",
        message: "No se pudo crear la conexion WebSocket.",
        details: error
      });
      this.scheduleReconnect();
      return;
    }

    this.socket.addEventListener("open", () => {
      this.currentReconnectDelayMs = this.reconnectDelayMs;
      this.emitLocal("CONNECTED", {
        type: "CONNECTED",
        appName: this.appName,
        clientId: this.clientId,
        wsUrl: this.wsUrl
      });
    });

    this.socket.addEventListener("message", (event) => {
      const message = parseJson(event.data);

      if (!message || !message.type) {
        this.emitLocal("ERROR", {
          type: "ERROR",
          message: "Se recibio un mensaje no valido desde el servidor.",
          raw: event.data
        });
        return;
      }

      this.emitLocal("MESSAGE", message);
      this.emitLocal(message.type, message);
    });

    this.socket.addEventListener("close", (event) => {
      this.emitLocal("DISCONNECTED", {
        type: "DISCONNECTED",
        code: event.code,
        reason: event.reason || "Sin detalle"
      });

      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener("error", () => {
      this.emitLocal("ERROR", {
        type: "ERROR",
        message: "Ocurrio un error en la conexion WebSocket."
      });
    });
  };

  SessionSyncClient.prototype.scheduleReconnect = function () {
    if (!this.autoReconnect || this.destroyed || this.manuallyClosed) {
      return;
    }

    if (this.reconnectTimer) {
      global.clearTimeout(this.reconnectTimer);
    }

    const delay = this.currentReconnectDelayMs;

    this.emitLocal("RECONNECT_SCHEDULED", {
      type: "RECONNECT_SCHEDULED",
      delayMs: delay
    });

    this.reconnectTimer = global.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);

    this.currentReconnectDelayMs = Math.min(
      this.currentReconnectDelayMs * 2,
      this.maxReconnectDelayMs
    );
  };

  SessionSyncClient.prototype.buildEnvelope = function (type, payload) {
    return {
      type: type,
      payload: payload || {},
      meta: {
        appName: this.appName,
        clientId: this.clientId,
        sourceUrl: global.location.href,
        origin: global.location.origin,
        sentAt: new Date().toISOString(),
        user: this.safeGetCurrentUser()
      }
    };
  };

  SessionSyncClient.prototype.send = function (type, payload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(this.buildEnvelope(type, payload)));
    return true;
  };

  SessionSyncClient.prototype.sendAppMessage = function (payload) {
    return this.send("APP_MESSAGE", payload);
  };

  SessionSyncClient.prototype.emitLogout = function (payload) {
    return this.send("SESSION_LOGOUT", payload);
  };

  SessionSyncClient.prototype.emitUserChanged = function (payload) {
    return this.send("SESSION_USER_CHANGED", payload);
  };

  SessionSyncClient.prototype.disconnect = function () {
    this.manuallyClosed = true;

    if (this.reconnectTimer) {
      global.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
    }
  };

  SessionSyncClient.prototype.destroy = function () {
    this.destroyed = true;
    this.disconnect();
    this.listeners.clear();
  };

  SessionSyncClient.prototype.getState = function () {
    if (!this.socket) {
      return "CLOSED";
    }

    const readyStateMap = {
      0: "CONNECTING",
      1: "OPEN",
      2: "CLOSING",
      3: "CLOSED"
    };

    return readyStateMap[this.socket.readyState] || "UNKNOWN";
  };

  global.SessionSyncClient = {
    createSessionSync: function (config) {
      return new SessionSyncClient(config);
    }
  };
})(window);
