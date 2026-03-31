export default defineNuxtRouteMiddleware( (to) => {
    const { loggedIn } = useUserSession()
    const loginPath = to.path == '/login' || to.path == '/register' || to.path == '/forgot-password'
    if (loginPath && loggedIn.value) {
        return navigateTo({path: '/'})
    }
})