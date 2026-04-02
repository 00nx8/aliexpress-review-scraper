export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password']
  const subscribeRoutes = ['/subscribe', '/subscribe/payment', '/subscribe/success']

  if (publicRoutes.includes(to.path)) return

  const { loggedIn, user } = useUserSession()

  if (!loggedIn.value) {
    console.log('not logged in')
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
