export const normaliseElevation = (e: number | null | undefined) =>
    e === null || e === undefined ? 0 : Math.max(0, e);  