"use client"

import React, { useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import styles from './LoginDialog.module.css'
import { loginWithPopup, loginWithEmailPasswordPopup } from '@/utils/Auth0/Login'
import { cn } from '@/lib/utils'
import TapiIcon from '@/components/common/icon/brand/TapiIcon'
import Link from 'next/link'
import { userSyncAPI } from '@/actions/auth/user-sync'
import { getUserProfileAPI } from '@/actions/auth/user-profile'
import { updateUserProfileLocal } from '@/utils/Auth0/User'
import { useAuthStore } from '@/components/auth/stores/auth-store'
import { toast } from 'sonner'
import SocialLogin from './social/SocialLogin'
import EmailLogin from './email/EmailLogin'
import RegisterLogin from './register/RegisterLogin'
import { AnimatePresence, motion } from 'motion/react'
import { auth0WebAuth } from '@/utils/Auth0/Auth0Client'
import { useRouter } from 'next/navigation'
import MarkdownRenderer from '../../../../common/markdown/MarkdownRenderer'

enum UiState {
    IDLE = 'idle',
    POPUP_OPEN = 'popup_open',
    PROCESSING = 'processing',
    SUCCESS = 'success',
    ERROR = 'error'
}

export default function LoginDialog() {
    const {
        isLoginDialogOpen,
        setIsLoginDialogOpen,
        startUserProfileStorageTrigger
    } = useAuthStore()
    const { setLoginStatus } = useAuthStore()
    const router = useRouter()
    const [uiState, setUiState] = React.useState<UiState>(UiState.IDLE)
    const [errorList, setErrorList] = React.useState<string[]>([])
    const [showErrorDetails, setShowErrorDetails] = React.useState(false)
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [emailLoading, setEmailLoading] = React.useState(false)
    const [emailError, setEmailError] = React.useState('')
    const [isEmailMode, setIsEmailMode] = React.useState(false)
    const [isRegisterMode, setIsRegisterMode] = React.useState(false)

    const [socialError, setSocialError] = React.useState('')


    // ROPG 弹窗超时后，强制下次邮箱登录直接走 Universal 弹窗
    const [forceUniversalForEmail, setForceUniversalForEmail] = React.useState(false)
    // 预检时，通过邮箱登录按钮更新状态显示
    const [isPreChecking, setIsPreChecking] = React.useState(false)

    const isBusy = uiState === 'popup_open' || uiState === 'processing'

    // 发起前预检：第三方 Cookie / web_message 是否受限（仅将确认为受限的错误判定为 true）
    // true 表示受限（应直接使用 Universal）；false 表示未受限（可进入本地 Email UI）
    const preflightCheck = React.useCallback(async (): Promise<boolean> => {
        return await new Promise<boolean>((resolve) => {
            try {
                auth0WebAuth.checkSession(
                    {
                        responseType: 'token id_token',
                        prompt: 'none',
                        timeout: 2500,
                    } as any,
                    (err) => {
                        if (!err) return resolve(false)
                        const code = String((err as any)?.error || '').toLowerCase()
                        const desc = String((err as any)?.errorDescription || (err as any)?.error_description || '').toLowerCase()
                        // 这些错误意味着 iframe 能返回（环境可用，只是需要交互/同意/未登录）
                        if (code === 'login_required' || code === 'consent_required' || code === 'interaction_required') {
                            return resolve(false)
                        }
                        // 这些错误通常由第三方 Cookie/ITP 或来源配置导致，视为受限
                        if (
                            code === 'timeout' ||
                            desc.includes('timeout') ||
                            desc.includes('web_message') ||
                            desc.includes('origin') ||
                            desc.includes('not allowed') ||
                            desc.includes('forbidden')
                        ) {
                            return resolve(true)
                        }
                        // 其他未知错误，保守起见按未受限处理，避免误伤
                        return resolve(false)
                    }
                )
            } catch {
                // 调用异常（例如环境不支持），按受限处理
                resolve(true)
            }
        })
    }, [])



    // 阻止用户在处理中离开页面
    React.useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!isBusy) return
            e.preventDefault()
        }
        const handleVisibilityChange = () => {
            if (isBusy && document.hidden) {
                alert('login is processing, please do not leave this page.')
            }
        }
        if (isBusy) {
            window.addEventListener('beforeunload', handleBeforeUnload)
            document.addEventListener('visibilitychange', handleVisibilityChange)
        }
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isBusy])

    // 30秒后显示详细错误提示（仅在 processing 状态）
    React.useEffect(() => {
        if (uiState !== 'processing') return
        setShowErrorDetails(false)
        const timer = setTimeout(() => setShowErrorDetails(true), 30000)
        return () => clearTimeout(timer)
    }, [uiState])

    const handleSocialPopup = React.useCallback((connection: string) => {
        // 进入弹窗已打开状态
        setErrorList([])
        setShowErrorDetails(false)
        setUiState(UiState.POPUP_OPEN)

        loginWithPopup(connection, async (err, result) => {
            if (err) {
                console.error('Popup 登录失败: ', err)
                const msg = (err as any)?.description || (err as any)?.error || ''
                if (msg?.toString().includes('web_message') || msg?.toString().toLowerCase().includes('timeout')) {
                    // web_message 超时 → 直接跳转授权
                    return
                }
                setErrorList(pre => [err.description || err.error || 'Login failed, please try again', ...pre])
                setUiState(UiState.ERROR)
                return
            }

            // 弹窗回调到达 → 进入 processing 状态
            setUiState(UiState.PROCESSING)

            try {
                const authResult = result as unknown as { accessToken?: string; idToken?: string; expiresIn?: number }

                if (authResult?.accessToken) {
                    localStorage.setItem('accessToken', authResult.accessToken)
                    await userSyncAPI(authResult.accessToken)
                    const userProfileResponse = await getUserProfileAPI(authResult.accessToken)
                    if (userProfileResponse.code === 200) {
                        const updated = updateUserProfileLocal(userProfileResponse.data)
                        if (updated) startUserProfileStorageTrigger()
                    } else {
                        throw new Error('User profile not found')
                    }
                }
                if (authResult?.idToken) {
                    localStorage.setItem('idToken', authResult.idToken)
                }
                if (authResult?.expiresIn) {
                    const expiresAt = JSON.stringify(authResult.expiresIn * 1000 + Date.now())
                    localStorage.setItem('expiresAt', expiresAt)
                }

                // 完成后显示成功状态（立刻关闭）
                toast.success('Signed in successfully')
                setLoginStatus(true)
                setIsLoginDialogOpen(false)
                setUiState(UiState.SUCCESS)

            } catch (e) {
                console.error('处理登录结果失败: ', e)
                setErrorList(pre => ['process auth result failed', ...pre])
                setUiState(UiState.ERROR)
            }
        })
    }, [setIsLoginDialogOpen, startUserProfileStorageTrigger])

    const handleEmailPasswordSubmit = React.useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (isBusy || emailLoading) return
        setEmailError('')
        setEmailLoading(true)
        setUiState(UiState.PROCESSING)
        loginWithEmailPasswordPopup(
            email,
            password,
            async (err, result) => {
                setEmailLoading(false)
                if (err) {
                    console.error('Popup Email 登录失败: ', err)
                    const errCode = (err as any)?.error || (err as any)?.code || ''
                    const errDesc = (err as any)?.description || (err as any)?.error_description || ''
                    const errCombined = `${String(errCode).toLowerCase()} ${String(errDesc).toLowerCase()}`
                    console.log('errCombined', errCombined)
                    // 关键兜底：web_message/timeout 记录标记，下一次点击邮箱入口时直接走 Universal 弹窗
                    if (errCombined.includes('web_message') || errCombined.includes('timeout')) {
                        setForceUniversalForEmail(true)
                        setSocialError('Browser restricted. Please click "Continue with Email" again to continue in a popup.')
                        setIsEmailMode(false)
                        setUiState(UiState.IDLE)
                        return
                    }
                    if (errCode === 'consent_required') {
                        try {
                            setEmailError('')
                            setUiState(UiState.PROCESSING)
                            auth0WebAuth.popup.authorize(
                                {
                                    prompt: 'consent',
                                    responseType: 'token id_token',
                                    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth/popup-callback` : '',
                                    scope: 'openid profile email',
                                    connection: 'Username-Password-Authentication',
                                } as any,
                                async (consentErr, consentResult) => {
                                    if (consentErr) {
                                        console.error('Consent 授权失败: ', consentErr)
                                        setEmailError((consentErr as unknown as { description?: string; error?: string }).description || (consentErr as unknown as { error?: string }).error || 'Consent failed, please try again')
                                        setUiState(UiState.IDLE)
                                        return
                                    }
                                    setUiState(UiState.PROCESSING)
                                    try {
                                        const authResult2 = consentResult as unknown as { accessToken?: string; idToken?: string; expiresIn?: number }
                                        if (authResult2?.accessToken) {
                                            localStorage.setItem('accessToken', authResult2.accessToken)
                                            await userSyncAPI(authResult2.accessToken)
                                            const userProfileResponse = await getUserProfileAPI(authResult2.accessToken)
                                            if (userProfileResponse.code === 200) {
                                                const updated = updateUserProfileLocal(userProfileResponse.data)
                                                if (updated) startUserProfileStorageTrigger()
                                            } else {
                                                throw new Error('User profile not found')
                                            }
                                        }
                                        if (authResult2?.idToken) localStorage.setItem('idToken', authResult2.idToken)
                                        if (authResult2?.expiresIn) localStorage.setItem('expiresAt', JSON.stringify(authResult2.expiresIn * 1000 + Date.now()))
                                        toast.success('Signed in successfully')
                                        setLoginStatus(true)
                                        setIsLoginDialogOpen(false)
                                        setUiState(UiState.SUCCESS)
                                    } catch (e) {
                                        console.error('处理登录结果失败: ', e)
                                        setEmailError('process auth result failed')
                                        setUiState(UiState.IDLE)
                                    }
                                }
                            )
                        } catch (e) {
                            console.error('触发 consent 弹窗失败: ', e)
                            setEmailError('open consent popup failed')
                            setUiState(UiState.IDLE)
                        }
                        return
                    }
                    setEmailError(errDesc || errCode || 'Login failed, please try again')
                    setUiState(UiState.IDLE)
                    return
                }

                setUiState(UiState.PROCESSING)
                try {
                    const authResult = result as unknown as { accessToken?: string; idToken?: string; expiresIn?: number }
                    if (authResult?.accessToken) {
                        localStorage.setItem('accessToken', authResult.accessToken)
                        await userSyncAPI(authResult.accessToken)
                        const userProfileResponse = await getUserProfileAPI(authResult.accessToken)
                        if (userProfileResponse.code === 200) {
                            const updated = updateUserProfileLocal(userProfileResponse.data)
                            if (updated) startUserProfileStorageTrigger()
                        } else {
                            throw new Error('User profile not found')
                        }
                    }
                    if (authResult?.idToken) localStorage.setItem('idToken', authResult.idToken)
                    if (authResult?.expiresIn) localStorage.setItem('expiresAt', JSON.stringify(authResult.expiresIn * 1000 + Date.now()))
                    toast.success('Signed in successfully')
                    setLoginStatus(true)
                    setIsLoginDialogOpen(false)
                    setUiState(UiState.SUCCESS)
                } catch (e) {
                    console.error('处理登录结果失败: ', e)
                    setEmailError('process auth result failed')
                    setUiState(UiState.IDLE)
                }
            }
        )
    }, [email, password, isBusy, emailLoading, startUserProfileStorageTrigger, preflightCheck])

    const OnEmailButtonClick = useCallback(() => {
        if (forceUniversalForEmail) {
            setUiState(UiState.POPUP_OPEN)
            loginWithPopup('Username-Password-Authentication', async (authErr, authResult) => {
                if (authErr) {
                    const msg = (authErr as any)?.description || (authErr as any)?.error || 'Login failed, please try again'
                    setEmailError(msg)
                    setUiState(UiState.IDLE)
                    return
                }
                setUiState(UiState.PROCESSING)
                try {
                    const r = authResult as unknown as { accessToken?: string; idToken?: string; expiresIn?: number }
                    if (r?.accessToken) {
                        localStorage.setItem('accessToken', r.accessToken)
                        await userSyncAPI(r.accessToken)
                        const userProfileResponse = await getUserProfileAPI(r.accessToken)
                        if (userProfileResponse.code === 200) {
                            const updated = updateUserProfileLocal(userProfileResponse.data)
                            if (updated) startUserProfileStorageTrigger()
                        } else {
                            throw new Error('User profile not found')
                        }
                    }
                    if (r?.idToken) localStorage.setItem('idToken', r.idToken)
                    if (r?.expiresIn) localStorage.setItem('expiresAt', JSON.stringify(r.expiresIn * 1000 + Date.now()))
                    toast.success('Signed in successfully')
                    setLoginStatus(true)
                    setIsLoginDialogOpen(false)
                    setUiState(UiState.SUCCESS)
                } catch (e) {
                    console.error('处理登录结果失败: ', e)
                    setEmailError('process auth result failed')
                    setUiState(UiState.IDLE)
                }
            })
            return
        }
        setIsPreChecking(true)
        preflightCheck().then((limited) => {
            if (limited) {
                // 受限环境：直接使用 Universal Login 弹窗（不启用watchdog）
                setUiState(UiState.POPUP_OPEN)
                loginWithPopup('Username-Password-Authentication', async (err, result) => {
                    setIsPreChecking(false)
                    if (err) {
                        const msg = (err as any)?.description || (err as any)?.error || 'Login failed, please try again'
                        setErrorList(pre => [msg, ...pre])
                        setUiState(UiState.ERROR)
                        return
                    }
                    setUiState(UiState.PROCESSING)
                    try {
                        const authResult = result as unknown as { accessToken?: string; idToken?: string; expiresIn?: number }
                        if (authResult?.accessToken) {
                            localStorage.setItem('accessToken', authResult.accessToken)
                            await userSyncAPI(authResult.accessToken)
                            const userProfileResponse = await getUserProfileAPI(authResult.accessToken)
                            if (userProfileResponse.code === 200) {
                                const updated = updateUserProfileLocal(userProfileResponse.data)
                                if (updated) startUserProfileStorageTrigger()
                            } else {
                                throw new Error('User profile not found')
                            }
                        }
                        if (authResult?.idToken) localStorage.setItem('idToken', authResult.idToken)
                        if (authResult?.expiresIn) localStorage.setItem('expiresAt', JSON.stringify(authResult.expiresIn * 1000 + Date.now()))
                        toast.success('Signed in successfully')
                        setLoginStatus(true)
                        setIsLoginDialogOpen(false)
                        setUiState(UiState.SUCCESS)
                    } catch (e) {
                        setErrorList(pre => ['process auth result failed', ...pre])
                        setUiState(UiState.ERROR)
                    }
                })
                return
            }
            // 非受限：进入本地 EmailLogin UI
            setIsEmailMode(true)
            setIsPreChecking(false)
        })
    }, [forceUniversalForEmail, startUserProfileStorageTrigger, preflightCheck])

    const handleOpenChange = (open: boolean) => {
        if (!open && isBusy) {
            toast.warning('login is processing, please do not close this dialog.')
            return
        }
        setIsLoginDialogOpen(open)
        if (!open) {
            setUiState(UiState.IDLE)
            setIsEmailMode(false)
            setEmail('')
            setPassword('')
            setEmailError('')
            setEmailLoading(false)
            setIsRegisterMode(false)
            setIsPreChecking(false)
            setSocialError('')
        }
    }

    const renderPopupOpen = () => (
        <motion.div
            className="login-dialog__popup-open text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key="popup-open"
        >
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mx-auto"></div>
            <p className="text-lg">Please continue in the popup window...</p>
            <p className="text-sm text-muted-foreground mt-2">Do not close this dialog until you finish.</p>
        </motion.div>
    )

    const renderProcessing = () => (
        <motion.div className="login-dialog__loading text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key="processing"
        >
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mx-auto"></div>
            <p className="text-lg">Signing in, please wait...</p>
            {showErrorDetails && errorList.length > 0 && (
                <div className="mt-6">
                    <p className="text-yellow-600 mb-3">Login is taking longer than expected...</p>
                    <div className="text-left bg-yellow-50 p-4 rounded-lg">
                        <h3 className="text-base font-semibold mb-2">Issues detected:</h3>
                        <ul className="list-disc pl-5 text-sm text-yellow-700">
                            {errorList.map((item, idx) => (
                                <li key={idx} className="mb-1">{item}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </motion.div>
    )

    const renderError = () => (
        <motion.div className="login-dialog__error text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key="error"
        >
            <p className="text-red-500 mb-4">Login failed.</p>
            {errorList.length > 0 && (
                <div className="text-left bg-red-50 p-4 rounded-lg">
                    <h3 className="text-base font-semibold mb-2">Error Details:</h3>
                    <ul className="list-disc pl-5 text-sm text-red-600">
                        {errorList.map((item, idx) => (
                            <li key={idx} className="mb-1">{item}</li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="mt-4 w-full flex justify-center">
                <button
                    onClick={() => {
                        setUiState(UiState.IDLE)
                        setErrorList([])
                        setShowErrorDetails(false)
                    }}
                    className="px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        </motion.div>
    )

    const renderSuccess = () => (
        <motion.div className="login-dialog__success text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key="success"
        >
            <div className="mx-auto mb-4 h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                </svg>
            </div>
            <p className="text-lg text-green-600">Signed in successfully</p>
            <p className="text-sm text-muted-foreground mt-1">You can safely continue.</p>
            <div className="mt-4">
                <button
                    onClick={() => setIsLoginDialogOpen(false)}
                    className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                    Continue
                </button>
            </div>
        </motion.div>
    )

    const renderAuthContent = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key="auth-content"
            className={styles.loginDialog_section}
        >
            <div className={styles.loginDialog_content_logo}>
                <TapiIcon className={styles.loginDialog_content_logo_icon} />
                <span className={styles.loginDialog_content_logo_text}>Daoer</span>
            </div>

            <AnimatePresence mode='wait'>
                {isRegisterMode ? (
                    <RegisterLogin
                        isBusy={isBusy}
                        onSwitchToLogin={() => { setIsRegisterMode(false); setIsEmailMode(true) }}
                        onProcessing={() => setUiState(UiState.PROCESSING)}
                        onSuccess={(accessToken, idToken, expiresIn) => {
                            if (accessToken) localStorage.setItem('accessToken', accessToken)
                            if (idToken) localStorage.setItem('idToken', idToken)
                            if (expiresIn) localStorage.setItem('expiresAt', JSON.stringify(expiresIn * 1000 + Date.now()))
                            toast.success('Signed up successfully')
                            setLoginStatus(true)
                            setIsLoginDialogOpen(false)
                            setUiState(UiState.SUCCESS)
                        }}
                        // onError={(msg) => setEmailError(msg)}
                        onError={() => { }}
                    />
                ) : isEmailMode ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        key="email-login"
                        className={styles.loginDialog_section}
                    >
                        <EmailLogin
                            email={email}
                            password={password}
                            isBusy={isBusy}
                            loading={emailLoading}
                            error={emailError}
                            onEmailChange={setEmail}
                            onPasswordChange={setPassword}
                            onSubmit={handleEmailPasswordSubmit}
                            onBack={() => setIsEmailMode(false)}
                            onSwitchToRegister={() => setIsRegisterMode(true)}
                        />
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        key="social-login"
                        className={styles.loginDialog_section}
                    >
                        <div className={styles.loginDialog_content_title}>
                            <span className={styles.loginDialog_content_title_text}>
                                Welcome to Daoer
                            </span>
                        </div>

                        {socialError && (
                            <div className={styles.loginDialog_error}>
                                <MarkdownRenderer content={socialError} variant='content' />
                            </div>
                        )}

                        <SocialLogin
                            isBusy={isBusy}
                            isEmailButtonBusy={isPreChecking}
                            onGoogle={() => handleSocialPopup('google-oauth2')}
                            onApple={() => handleSocialPopup('apple')}
                            onEmail={OnEmailButtonClick}
                        />

                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode='wait'>
                {!isRegisterMode &&
                    <motion.div className={styles.loginDialog_tip}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.span className={styles.loginDialog_tip_text}>
                            {'by signing up，I agree to '}
                            <span className={styles.loginDialog_tip_link}>
                                <Link
                                    href="/terms_of_service"
                                    target="_blank"
                                >Terms of Service</Link>
                            </span>
                            {' and '}
                            <span className={styles.loginDialog_tip_link}>
                                <Link
                                    href="/privacy_policy"
                                    target="_blank"
                                >Privacy Policy
                                </Link>
                            </span>
                        </motion.span>
                    </motion.div>
                }
            </AnimatePresence>
        </motion.div>
    )

    return (
        <Dialog open={isLoginDialogOpen} onOpenChange={handleOpenChange}>
            <DialogContent
                className={cn(styles.loginDialog_container, "loginDialog_container")}
                aria-describedby={'login-dialog-desc'}
                showCloseButton={uiState === UiState.ERROR}
            >
                <DialogHeader className={styles.loginDialog_header}>
                    <DialogTitle className={styles.loginDialog_title}>Sign in</DialogTitle>
                    <DialogDescription id={'login-dialog-desc'}>
                        {uiState === UiState.IDLE && 'Choose a provider to continue.'}
                        {uiState === UiState.POPUP_OPEN && 'Popup opened. Continue in the popup window.'}
                        {uiState === UiState.PROCESSING && 'Signing you in, please wait...'}
                        {uiState === UiState.SUCCESS && 'Signed in successfully.'}
                        {uiState === UiState.ERROR && 'Login failed.'}
                    </DialogDescription>
                </DialogHeader>

                <div className={styles.loginDialog_content} aria-busy={isBusy}>
                    <AnimatePresence mode='wait'>
                        {uiState === UiState.POPUP_OPEN ? renderPopupOpen()
                            : uiState === UiState.PROCESSING ? renderProcessing()
                                : uiState === UiState.SUCCESS ? renderSuccess()
                                    : uiState === UiState.ERROR ? renderError()
                                        : renderAuthContent()}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    )
}
