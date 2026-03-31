export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  const subscribeRoutes = ['/subscribe', '/subscribe/payment']

  if (publicRoutes.includes(to.path)) return

  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  // Redirect to subscription selection if unset
  if (!subscribeRoutes.includes(to.path)) {
    const sub = (user.value as any)?.subscriptionType
    if (!sub || sub === 'unset') {
      return navigateTo('/subscribe')
    }
  }
})
