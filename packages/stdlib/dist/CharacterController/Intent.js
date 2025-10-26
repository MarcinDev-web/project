export const EMPTY_INTENT = Object.freeze({
    move: [0, 0],
    look: [0, 0],
    jump: false,
    sprint: false,
    use: false,
    interact: false,
    ability: null,
});
export function cloneIntent(intent) {
    return {
        move: [intent.move[0], intent.move[1]],
        look: [intent.look[0], intent.look[1]],
        jump: intent.jump,
        sprint: intent.sprint,
        use: intent.use,
        interact: intent.interact,
        ability: intent.ability,
    };
}
export function resetIntent(intent) {
    intent.move[0] = 0;
    intent.move[1] = 0;
    intent.look[0] = 0;
    intent.look[1] = 0;
    intent.jump = false;
    intent.sprint = false;
    intent.use = false;
    intent.interact = false;
    intent.ability = null;
}
//# sourceMappingURL=Intent.js.map