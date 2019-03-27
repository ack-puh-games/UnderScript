onPage("gameSpectate", function () {
  debug("Spectating Game");
  eventManager.emit("GameStart");

  eventManager.on(':loaded', () => {
    function callGameHooks(data, original) {
      const run = !eventManager.emit('PreGameEvent', data, data.action === 'getResult').canceled;
      try {
        if (run) original(data);
      } catch (e) {
        console.error(e);
      }
      eventManager.emit('GameEvent', data);
    }
    if (undefined !== window.bypassQueueEvents) {
      const oRunEvent = runEvent;
      const oBypassEvent = bypassQueueEvent;
      runEvent = function runEventScript(event) {
        callGameHooks(event, oRunEvent);
      };
      bypassQueueEvent = function runEventScript(event) {
        callGameHooks(event, oBypassEvent);
      };
    } else {
      debug(`You\'re a fool.`);
    }
  });
});
