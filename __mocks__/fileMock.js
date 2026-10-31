// Stub dla require()'ów obrazków w testach — Metro obsługuje je natywnie, Jest
// (środowisko node, bez Metro) nie umie parsować binarnych PNG. Port 1:1 z sapp.
module.exports = 'test-image-stub';
