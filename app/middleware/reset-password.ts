export default defineNuxtRouteMiddleware(async (to) => {
    const token = await to.query.token
    if (!token) {
        return navigateTo({path: "/"})
    }
})