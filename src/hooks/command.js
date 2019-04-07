eventManager.on('Chat:send', function chatCommand({ input, room }) {
  const raw = input.value;
  if (this.canceled || !raw.startsWith('/')) return;
  const index = raw.includes(' ') ? raw.indexOf(' ') : undefined;
  const command = raw.substring(1, index);
  const text = index === undefined ? '' : raw.substring(index + 1);
  const data = { room, input, command, text, output: '' };
  const event = eventManager.emit('Chat:command', data);
  this.canceled = event.canceled;
  if (data.output === undefined) return;
  input.value = data.output;
});