(function (global) {
  "use strict";

  const PAGE_ID = "pagina1";
  const PAGE_LABEL = "Pagina 1";
  const AVAILABLE_USERS = ["ana@misitio.com", "bruno@misitio.com", "carla@misitio.com"];
  const state = {
    currentUser: "ana@misitio.com"
  };

  const elements = {
    status: document.getElementById("status"),
    connection: document.getElementById("connectionStatus"),
    user: document.getElementById("currentUser"),
    messageList: document.getElementById("messageList"),
    sendButton: document.getElementById("sendButton"),
    logoutButton: document.getElementById("logoutButton"),
    switchUserButton: document.getElementById("switchUserButton"),
    clearButton: document.getElementById("clearButton")
  };

  function buildWsUrl() {
    const protocol = global.location.protocol === "https:" ? "wss:" : "ws:";
    return protocol + "//" + global.location.hostname + ":8081";
  }

  function setStatus(text) {
    elements.status.textContent = text;
  }

  function setConnection(text) {
    elements.connection.textContent = text;
  }

  function renderUser() {
    elements.user.textContent = state.currentUser || "Sin sesion";
  }

  function clearPlaceholder() {
    const firstItem = elements.messageList.firstElementChild;

    if (firstItem && firstItem.textContent === "No hay mensajes recibidos todavia.") {
      elements.messageList.innerHTML = "";
    }
  }

  function ensurePlaceholder() {
    if (!elements.messageList.children.length) {
      elements.messageList.innerHTML = "<li>No hay mensajes recibidos todavia.</li>";
    }
  }

  function addLogEntry(kind, details) {
    clearPlaceholder();

    const item = document.createElement("li");
    item.textContent = "[" + kind + "] " + details;
    elements.messageList.prepend(item);
  }

  function applyLogout(sourceApp, reason) {
    state.currentUser = null;
    renderUser();
    addLogEntry("logout", "Origen: " + sourceApp + " | motivo: " + reason);
  }

  function applyUserChanged(sourceApp, nextUser, previousUser) {
    state.currentUser = nextUser || "desconocido";
    renderUser();
    addLogEntry(
      "user-change",
      "Origen: " + sourceApp + " | anterior: " + (previousUser || "Sin sesion") + " | nuevo: " + state.currentUser
    );
  }

  function pickNextUser() {
    const index = AVAILABLE_USERS.indexOf(state.currentUser);
    const nextIndex = index === -1 ? 0 : (index + 1) % AVAILABLE_USERS.length;
    return AVAILABLE_USERS[nextIndex];
  }

  const client = global.SessionSyncClient.createSessionSync({
    wsUrl: buildWsUrl(),
    appName: PAGE_LABEL,
    clientId: PAGE_ID,
    getCurrentUser: function () {
      return state.currentUser ? { name: state.currentUser } : null;
    }
  });

  client.on("CONNECTED", function () {
    setConnection("Conectado");
    setStatus("Canal WebSocket conectado.");
  });

  client.on("DISCONNECTED", function () {
    setConnection("Desconectado");
    setStatus("Conexion cerrada. Esperando reconexion automatica...");
  });

  client.on("RECONNECT_SCHEDULED", function (event) {
    setConnection("Reconectando");
    setStatus("Reintentando conexion en " + event.delayMs + " ms.");
  });

  client.on("ERROR", function (event) {
    setStatus(event.message || "Ocurrio un error en la comunicacion.");
  });

  client.on("SERVER_READY", function (event) {
    addLogEntry("server", "Canal listo | clientes conectados: " + event.payload.connectedClients);
  });

  client.on("APP_MESSAGE", function (event) {
    if (event.meta && event.meta.clientId === PAGE_ID) {
      return;
    }

    const sourceApp = event.meta && event.meta.appName ? event.meta.appName : "Desconocido";
    const sourceUser = event.meta && event.meta.user ? event.meta.user.name : "Sin sesion";
    const messageText = event.payload && event.payload.text ? event.payload.text : "Sin contenido";

    addLogEntry("mensaje", "Origen: " + sourceApp + " | usuario: " + sourceUser + " | mensaje: " + messageText);
    setStatus("Mensaje recibido desde " + sourceApp + ".");
  });

  client.on("SESSION_LOGOUT", function (event) {
    if (event.meta && event.meta.clientId === PAGE_ID) {
      return;
    }

    const sourceApp = event.meta && event.meta.appName ? event.meta.appName : "Desconocido";
    const reason = event.payload && event.payload.reason ? event.payload.reason : "logout_global";

    applyLogout(sourceApp, reason);
    setStatus("Se recibio una solicitud de cierre de sesion desde " + sourceApp + ".");
  });

  client.on("SESSION_USER_CHANGED", function (event) {
    if (event.meta && event.meta.clientId === PAGE_ID) {
      return;
    }

    const sourceApp = event.meta && event.meta.appName ? event.meta.appName : "Desconocido";
    const nextUser = event.payload && event.payload.nextUser ? event.payload.nextUser : "desconocido";
    const previousUser = event.payload && event.payload.previousUser ? event.payload.previousUser : "Sin sesion";

    applyUserChanged(sourceApp, nextUser, previousUser);
    setStatus("Cambio global de usuario recibido desde " + sourceApp + ".");
  });

  elements.sendButton.addEventListener("click", function () {
    const messageText = "Hola desde " + PAGE_LABEL;
    const sent = client.sendAppMessage({
      text: messageText
    });

    if (!sent) {
      setStatus("No se pudo enviar el mensaje porque el socket no esta conectado.");
      return;
    }

    addLogEntry("emitido", "Origen: " + PAGE_LABEL + " | usuario: " + (state.currentUser || "Sin sesion") + " | mensaje: " + messageText);
    setStatus("Mensaje enviado al canal compartido.");
  });

  elements.logoutButton.addEventListener("click", function () {
    applyLogout(PAGE_LABEL, "logout_global");

    const sent = client.emitLogout({
      reason: "logout_global"
    });

    if (!sent) {
      setStatus("Se aplico el logout local, pero no se pudo notificar a las otras apps.");
      return;
    }

    setStatus("Logout global enviado.");
  });

  elements.switchUserButton.addEventListener("click", function () {
    const previousUser = state.currentUser;
    const nextUser = pickNextUser();

    applyUserChanged(PAGE_LABEL, nextUser, previousUser);

    const sent = client.emitUserChanged({
      previousUser: previousUser,
      nextUser: nextUser,
      reason: "switch_user"
    });

    if (!sent) {
      setStatus("Se cambio el usuario local, pero no se pudo notificar a las otras apps.");
      return;
    }

    setStatus("Cambio global de usuario enviado.");
  });

  elements.clearButton.addEventListener("click", function () {
    elements.messageList.innerHTML = "";
    ensurePlaceholder();
    setStatus("Resumen limpiado.");
  });

  renderUser();
  ensurePlaceholder();
  setConnection("Conectando...");
  client.connect();

  global.addEventListener("beforeunload", function () {
    client.disconnect();
  });
})(window);
