import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Card, Field, HeroCard, Page, PrimaryButton, SegmentedControl, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { colors, fonts, radius, spacing } from '../theme';

type PortalTab = 'workforce' | 'client';
type Flow = 'signin' | 'signup';

const devAutoLoginEnabled = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_ENABLED?.trim().toLowerCase() === 'true';
const devAutoLoginEmail = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_EMAIL?.trim() || '';
const devAutoLoginPassword = process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_PASSWORD?.trim() || '';
const devAutoLoginPortal =
  process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_PORTAL?.trim().toLowerCase() === 'partner'
    ? 'partner'
    : process.env.EXPO_PUBLIC_DEV_AUTO_LOGIN_PORTAL?.trim().toLowerCase() === 'admin'
      ? 'admin'
      : 'office';

function AuthShell({
  eyebrow,
  title,
  subtitle,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: string;
  children: ReactNode;
}) {
  return (
    <Page>
      <HeroCard
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        aside={<StatusChip label={badge} tone={badge === 'بوابة العملاء' ? 'gold' : 'danger'} />}
      />

      <View style={styles.logoWrap}>
        <Image source={require('../../assets/masar-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>

      {children}
    </Page>
  );
}

export function AuthScreen() {
  const navigation = useNavigation<any>();
  const {
    signInWithPassword,
    requestOfficeOtpAfterPassword,
    signInOfficeWithOtp,
    requestOtp,
    signInClientWithOtp,
    signUpOffice,
    resendActivation,
  } = useAuth();
  const autoLoginAttemptedRef = useRef(false);

  const [portalTab, setPortalTab] = useState<PortalTab>('workforce');
  const [flow, setFlow] = useState<Flow>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [firmName, setFirmName] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (
      !__DEV__ ||
      !devAutoLoginEnabled ||
      autoLoginAttemptedRef.current ||
      !devAutoLoginEmail ||
      !devAutoLoginPassword
    ) {
      return;
    }

    autoLoginAttemptedRef.current = true;
    setPortalTab('workforce');
    setFlow('signin');
    setEmail(devAutoLoginEmail);
    setSubmitting(true);
    setError('');
    setMessage('جارٍ تسجيل الدخول التجريبي...');

    let active = true;

    void signInWithPassword({
      email: devAutoLoginEmail,
      password: devAutoLoginPassword,
      targetPortal: devAutoLoginPortal,
    })
      .catch((nextError) => {
        if (!active) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : 'تعذر تسجيل الدخول.');
        setMessage('');
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setSubmitting(false);
      });

    return () => {
      active = false;
    };
  }, [signInWithPassword]);

  function resetMessages() {
    setError('');
    setMessage('');
  }

  function handlePortalTabChange(nextTab: PortalTab) {
    setPortalTab(nextTab);
    setFlow('signin');
    setCode('');
    setOtpRequested(false);
    resetMessages();
  }

  function handleFlowChange(nextFlow: Flow) {
    setFlow(nextFlow);
    setCode('');
    setOtpRequested(false);
    resetMessages();
  }

  async function handleWorkforceStartSignIn() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password.trim()) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      const nextMessage = await requestOfficeOtpAfterPassword({
        email: normalizedEmail,
        password,
      });
      setMessage(nextMessage);
      setOtpRequested(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر بدء التحقق بخطوتين.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWorkforceVerifyOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || normalizedCode.length < 4) {
      setError('يرجى إدخال البريد الإلكتروني ورمز التحقق.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      await signInOfficeWithOtp({
        email: normalizedEmail,
        code: normalizedCode,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر التحقق من الرمز.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClientRequestOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      const nextMessage = await requestOtp(normalizedEmail);
      setMessage(nextMessage);
      setOtpRequested(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إرسال الرمز.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClientVerifyOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || normalizedCode.length < 4) {
      setError('يرجى إدخال البريد الإلكتروني والرمز.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      await signInClientWithOtp({ email: normalizedEmail, code: normalizedCode });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر التحقق من الرمز.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUp() {
    if (!fullName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      setError('أكمل الاسم والبريد وكلمة المرور ورقم الجوال.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      const nextMessage = await signUpOffice({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        firmName: firmName.trim(),
      });

      setFlow('signin');
      setOtpRequested(false);
      setCode('');
      setMessage(nextMessage);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إنشاء الحساب.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendActivation() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('أدخل البريد الإلكتروني أولاً لإعادة إرسال التفعيل.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      const nextMessage = await resendActivation(normalizedEmail);
      setMessage(nextMessage);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إعادة إرسال رسالة التفعيل.');
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle =
    portalTab === 'workforce'
      ? 'دخول موحد لأصحاب المكاتب وشركاء النجاح والإدارة. أدخل البريد وكلمة المرور، ثم يصلك OTP تلقائيًا، وبعدها يتم تحويلك تلقائيًا إلى البوابة المناسبة.'
      : 'دخول العملاء يبقى كما هو: البريد الإلكتروني ثم رمز تحقق OTP ثم التحويل مباشرة إلى بوابة العملاء.';

  return (
    <AuthShell
      eyebrow="مسار المحامي"
      title="بوابة دخول موحدة"
      subtitle={subtitle}
      badge={portalTab === 'workforce' ? 'بوابة الفريق' : 'بوابة العملاء'}
    >
      <Card>
        <SegmentedControl
          options={[
            { key: 'workforce', label: 'بوابة الفريق' },
            { key: 'client', label: 'بوابة العملاء' },
          ]}
          value={portalTab}
          onChange={(value) => handlePortalTabChange(value as PortalTab)}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {__DEV__ && !devAutoLoginEnabled ? (
          <Text style={styles.helper}>
            تم إيقاف الدخول التلقائي التجريبي. استخدم بيانات الحساب الحقيقية لاختبار التحويل التلقائي إلى المكتب أو الشريك أو الإدارة.
          </Text>
        ) : null}

        {portalTab === 'workforce' ? (
          flow === 'signup' ? (
            <>
              <Field
                label="الاسم الكامل"
                value={fullName}
                onChangeText={setFullName}
                placeholder="عبدالعزيز الحازمي"
                editable={!submitting}
              />
              <Field
                label="البريد الإلكتروني"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                editable={!submitting}
              />
              <Field
                label="رقم الجوال"
                value={phone}
                onChangeText={setPhone}
                placeholder="05xxxxxxxx"
                editable={!submitting}
              />
              <Field
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                editable={!submitting}
              />
              <Field
                label="اسم المكتب"
                value={firmName}
                onChangeText={setFirmName}
                placeholder="اختياري"
                editable={!submitting}
              />
              <PrimaryButton
                title="إنشاء حساب مكتب جديد"
                onPress={handleSignUp}
                disabled={submitting || !fullName.trim() || !email.trim() || !phone.trim() || !password.trim()}
              />
              <Pressable onPress={() => handleFlowChange('signin')} disabled={submitting}>
                <Text style={styles.linkText}>لدي حساب بالفعل</Text>
              </Pressable>
              <Text style={styles.helper}>
                بعد إنشاء الحساب سيتم إرسال رابط التفعيل إلى البريد الإلكتروني. فعّل البريد ثم عد إلى شاشة الدخول.
              </Text>
            </>
          ) : (
            <>
              <Field
                label="البريد الإلكتروني"
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                editable={!submitting}
              />
              <Field
                label="كلمة المرور"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                editable={!submitting}
              />

              {otpRequested ? (
                <Field
                  label="رمز التحقق"
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  keyboardType="numeric"
                  editable={!submitting}
                />
              ) : null}

              <PrimaryButton
                title={otpRequested ? 'تأكيد الدخول' : 'متابعة'}
                onPress={otpRequested ? handleWorkforceVerifyOtp : handleWorkforceStartSignIn}
                disabled={
                  submitting ||
                  !email.trim() ||
                  !password.trim() ||
                  (otpRequested && code.trim().length < 4)
                }
              />

              {otpRequested ? (
                <PrimaryButton
                  title="إعادة إرسال OTP"
                  onPress={handleWorkforceStartSignIn}
                  disabled={submitting || !email.trim() || !password.trim()}
                  secondary
                />
              ) : null}

              <PrimaryButton
                title="إعادة إرسال رسالة التفعيل"
                onPress={handleResendActivation}
                disabled={submitting || !email.trim()}
                secondary
              />

              <View style={styles.inlineActions}>
                <Pressable onPress={() => handleFlowChange('signup')} disabled={submitting}>
                  <Text style={styles.linkText}>تسجيل مكتب جديد</Text>
                </Pressable>
              </View>

              <Text style={styles.helper}>
                بعد التحقق من كلمة المرور، سيتم إرسال OTP تلقائيًا إلى البريد. عند إدخاله، نحولك تلقائيًا إلى المكتب أو بوابة الشركاء أو الإدارة حسب نوع الحساب.
              </Text>
            </>
          )
        ) : (
          <>
            <Field
              label="البريد الإلكتروني"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              editable={!submitting}
            />

            {otpRequested ? (
              <Field
                label="رمز التحقق"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="numeric"
                editable={!submitting}
              />
            ) : null}

            <PrimaryButton
              title={otpRequested ? 'تأكيد الدخول' : 'إرسال OTP'}
              onPress={otpRequested ? handleClientVerifyOtp : handleClientRequestOtp}
              disabled={submitting || !email.trim() || (otpRequested && code.trim().length < 4)}
            />

            {otpRequested ? (
              <PrimaryButton title="إعادة إرسال OTP" onPress={handleClientRequestOtp} disabled={submitting} secondary />
            ) : null}

            <Text style={styles.helper}>
              حساب العميل يُنشأ من داخل النظام، وبعدها يدخل العميل بنفس بريده الإلكتروني ويستلم رمز التحقق ثم يتحول تلقائيًا إلى بوابة العملاء.
            </Text>
          </>
        )}

        {submitting ? <ActivityIndicator color={colors.primary} /> : null}
      </Card>

      {portalTab === 'client' ? (
        <Card muted>
          <Text style={styles.altTitle}>بوابة الفريق</Text>
          <Text style={styles.altText}>
            مخصصة لأصحاب المكاتب وشركاء النجاح والإدارة. تعتمد كلمة المرور أولًا ثم التحقق بخطوتين عبر OTP.
          </Text>
          <PrimaryButton
            title="الانتقال إلى بوابة الفريق"
            onPress={() => {
              setPortalTab('workforce');
              setFlow('signin');
              setOtpRequested(false);
              setCode('');
              resetMessages();
            }}
            secondary
          />
        </Card>
      ) : null}
    </AuthShell>
  );
}

export function ClientAuthScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    navigation.replace('Auth');
  }, [navigation]);

  return null;
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 90,
  },
  inlineActions: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkText: {
    color: colors.primary,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
    textAlign: 'right',
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  message: {
    color: colors.success,
    fontFamily: fonts.arabicMedium,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  helper: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
  altTitle: {
    color: colors.primary,
    fontFamily: fonts.arabicBold,
    fontSize: 18,
    textAlign: 'right',
  },
  altText: {
    color: colors.textMuted,
    fontFamily: fonts.arabicRegular,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'right',
  },
});
