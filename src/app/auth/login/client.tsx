'use client'
import { useState } from "react";
import Link from "next/link"
import { loginWithSocialConnection } from "@/utils/Auth0/Login"
import { auth0WebAuth } from "@/utils/Auth0/Auth0Client"
import styles from './LoginPage.module.css'

function LoginClient() {
    const [loading, setLoading] = useState(false)
    const [loadingType, setLoadingType] = useState<string | null>(null)

    // 处理社交登录（Google/Apple）
    const handleSocialLogin = (connection: string) => {
        setLoading(true)
        setLoadingType(connection)
        loginWithSocialConnection(connection)
    }

    // 处理 Email 登录 - 跳转到 Auth0 Universal Login
    const handleEmailLogin = () => {
        setLoading(true)
        setLoadingType('email')
        
        if (typeof window !== 'undefined') {
            auth0WebAuth.authorize({
                connection: 'Username-Password-Authentication',
                responseType: 'token id_token',
                redirectUri: `${window.location.origin}/auth/callback`,
                scope: 'openid profile email',
            })
        }
    }

    return (
        <main className={styles['login-page']}>
            <div className={styles['login-page__container']}>
                <h1 className={styles['login-page__title']}>Welcome to Daoer</h1>
                <div className={styles['login-page__card']}>
                    <div className={styles['login-page__content']}>
                        {/* Google 登录按钮 */}
                        <div className={styles['login-page__social-buttons']}>
                            <button
                                className={styles['login-page__social-button']}
                                onClick={() => handleSocialLogin('google-oauth2')}
                                disabled={loading}
                            >
                                {loadingType === 'google-oauth2' ? (
                                    <span className={styles['login-page__spinner']}></span>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className={styles['login-page__social-icon']} viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                )}
                                <span>Continue with Google</span>
                            </button>

                            {/* Apple 登录按钮 */}
                            <button
                                className={styles['login-page__social-button']}
                                onClick={() => handleSocialLogin('apple')}
                                disabled={loading}
                            >
                                {loadingType === 'apple' ? (
                                    <span className={styles['login-page__spinner']}></span>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className={styles['login-page__social-icon']} viewBox="0 0 24 24">
                                        <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.39C2.79 15.37 3.51 7.01 9.07 6.54c1.38-.11 2.32.63 3.12.65.93-.06 1.8-.79 3.06-.67 1.3.13 2.26.53 2.93 1.4-2.3 1.45-1.77 4.68.64 5.65-1.06 2.77-3.02 4.85-4.76 6.71h-.01z" fill="black" />
                                        <path d="M12.03 6.3C11.78 4.58 13.19 3.1 14.9 3c.29 2.2-2.22 3.83-2.87 3.3z" fill="black" />
                                    </svg>
                                )}
                                <span>Continue with Apple</span>
                            </button>
                        </div>

                        {/* 分隔线 */}
                        <div className={styles['login-page__divider']}>
                            <span className={styles['login-page__divider-text']}>or sign in with email</span>
                        </div>

                        {/* Email 登录按钮 */}
                        <button
                            className={styles['login-page__email-button']}
                            onClick={handleEmailLogin}
                            disabled={loading}
                        >
                            {loadingType === 'email' ? (
                                <span className={styles['login-page__spinner-light']}></span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="21" height="20" viewBox="0 0 21 20" fill="none">
                                    <path d="M15.1683 5H5.83496C5.30453 5 4.79582 5.19754 4.42075 5.54917C4.04567 5.90081 3.83496 6.37772 3.83496 6.875V13.125C3.83496 13.6223 4.04567 14.0992 4.42075 14.4508C4.79582 14.8025 5.30453 15 5.83496 15H15.1683C15.6987 15 16.2074 14.8025 16.5825 14.4508C16.9576 14.0992 17.1683 13.6223 17.1683 13.125V6.875C17.1683 6.37772 16.9576 5.90081 16.5825 5.54917C16.2074 5.19754 15.6987 5 15.1683 5ZM15.1683 6.25L10.835 9.04375C10.7336 9.09861 10.6187 9.12748 10.5016 9.12748C10.3846 9.12748 10.2696 9.09861 10.1683 9.04375L5.83496 6.25H15.1683Z" fill="white" />
                                </svg>
                            )}
                            <span>{loadingType === 'email' ? 'Redirecting...' : 'Continue with Email'}</span>
                        </button>

                        {/* 条款提示 */}
                        <div className={styles['login-page__terms']}>
                            <span>
                                by signing in, I agree to{' '}
                                <Link href="/terms_of_service" target="_blank" className={styles['login-page__terms-link']}>
                                    Terms of Service
                                </Link>
                                {' '}and{' '}
                                <Link href="/privacy_policy" target="_blank" className={styles['login-page__terms-link']}>
                                    Privacy Policy
                                </Link>
                            </span>
                        </div>

                        {/* 注册提示 */}
                        {/* <div className={styles['login-page__signup-text']}>
                            don't have an account? <Link href="/auth/register" className={styles['login-page__signup-link']}>sign up</Link>
                        </div> */}
                    </div>
                </div>
            </div>
        </main>
    )
}

export default LoginClient;
