settings.register({
  name: 'Disable ping toasts',
  key: 'underscript.disable.pingToast',
  default: true,
  page: 'Chat',
});

settings.register({
  name: 'On',
  key: 'underscript.ping.extras',
  type: 'array',
  experimental: true,
  category: 'Ping Me',
  page: 'Chat',
});

(() => {
  eventManager.on('Chat:getMessage', function pingToast(data) {
    if (this.canceled || settings.value('underscript.disable.pingToast')) return;
    const msg = JSON.parse(data.chatMessage);
    if (msg.user.id === selfId) return;
    if (!fn.pingRegex().test(msg.message)) return;
    const avatar = !settings.value('chatAvatarsDisabled') ? `<img src="/images/avatars/${msg.user.avatar.image}.png" class="avatar ${msg.user.avatar.rarity}" height="35" style="float: left; margin-right: 7px;">` : '';
    fn.toast({
      title: `${avatar}${msg.user.username} (${chatRoomNames[data.room]})`,
      text: msg.message,
    });
  });
})();
