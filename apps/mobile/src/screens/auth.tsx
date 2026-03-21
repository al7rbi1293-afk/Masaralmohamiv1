import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Field, HeroCard, Page, PrimaryButton, StatusChip } from '../components/ui';
import { useAuth } from '../context/auth-context';
import { colors, fonts, radius, spacing } from '../theme';

type Mode = 'office' | 'client' | 'partner' | 'admin';
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

export function AuthScreen() {
  const {
    signInWithPassword,
    requestOfficeOtp,
    signInOfficeWithOtp,
    requestOtp,
    signInClientWithOtp,
    signUpOffice,
    resendActivation,
  } = useAuth();
  const autoLoginAttemptedRef = useRef(false);

  const [mode, setMode] = useState<Mode>('office');
  const [flow, setFlow] = useState<Flow>('signin');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
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
    setMode(devAutoLoginPortal);
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

  function handleModeChange(nextMode: Mode) {
    setMode(nextMode);
    setCode('');
    setOtpRequested(false);
    if (nextMode !== 'office') {
      setFlow('signin');
    }
    resetMessages();
  }

  function handleFlowChange(nextFlow: Flow) {
    setFlow(nextFlow);
    setCode('');
    setOtpRequested(false);
    resetMessages();
  }

  async function handleRequestOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('يرجى إدخال البريد الإلكتروني.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      const nextMessage =
        mode === 'client'
          ? await requestOtp(normalizedEmail)
          : await requestOfficeOtp(normalizedEmail);
      setMessage(nextMessage);
      setOtpRequested(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'تعذر إرسال الرمز.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();
    if (!normalizedEmail || normalizedCode.length < 4) {
      setError('يرجى إدخال البريد الإلكتروني والرمز.');
      return;
    }

    setSubmitting(true);
    resetMessages();

    try {
      if (mode === 'client') {
        await signInClientWithOtp({ email: normalizedEmail, code: normalizedCode });
        return;
      }

      await signInOfficeWithOtp({
        email: normalizedEmail,
        code: normalizedCode,
        targetPortal: mode === 'partner' ? 'partner' : mode === 'admin' ? 'admin' : 'office',
      });
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
    flow === 'signup'
      ? 'أنشئ حساب مكتب جديد ثم فعّل البريد الإلكتروني قبل أول دخول.'
      : mode === 'office'
        ? 'دخول المكتب عبر رمز تحقق يصل إلى البريد الإلكتروني لكل أعضاء الفريق.'
        : mode === 'client'
          ? 'بوابة العميل تعمل برمز تحقق على البريد الإلكتروني.'
          : mode === 'partner'
            ? 'بوابة الشريك تعمل الآن أيضًا برمز تحقق على البريد الإلكتروني.'
            : 'الدخول إلى لوحة الإدارة يتم عبر رمز تحقق مع صلاحيات الأدمن.';

  const modeLabel =
    mode === 'client'
      ? 'بوابة العميل'
      : mode === 'partner'
        ? 'بوابة الشريك'
        : mode === 'admin'
          ? 'الإدارة'
          : 'تشغيل المكتب';

  return (
    <Page>
      <HeroCard
        eyebrow="مسار المحامي"
        title="منصة واحدة للمكتب والعميل والشريك والإدارة"
        subtitle={subtitle}
        aside={<StatusChip label={modeLabel} tone={mode === 'admin' ? 'danger' : 'gold'} />}
      />

      <View style={styles.logoWrap}>
        <Image source={require('../../assets/masar-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>

      <Card>
        <View style={styles.segmentRow}>
          {[
            { key: 'office', label: 'المكتب' },
            { key: 'client', label: 'العميل' },
            { key: 'partner', label: 'الشريك' },
            { key: 'admin', label: 'الإدارة' },
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => handleModeChange(item.key as Mode)}
              style={[styles.segment, mode === item.key && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, mode === item.key && styles.segmentTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'office' ? (
          <View style={styles.flowRow}>
            {[
              { key: 'signin', label: 'تسجيل الدخول' },
              { key: 'signup', label: 'تسجيل جديد' },
            ].map((item) => (
              <Pressable
                key={item.key}
                onPress={() => handleFlowChange(item.key as Flow)}
                style={[styles.flowChip, flow === item.key && styles.flowChipActive]}
              >
                <Text style={[styles.flowChipText, flow === item.key && styles.flowChipTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}

        {__DEV__ && !devAutoLoginEnabled ? (
          <Text style={styles.helper}>
            تم إيقاف الدخول التلقائي التجريبي. سجّل بنفس بيانات الموقع الحالية لاختبار التطبيق على بياناتك الحقيقية.
          </Text>
        ) : null}

        {flow === 'signup' ? (
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
              title="إنشاء الحساب"
              onPress={handleSignUp}
              disabled={submitting || !fullName.trim() || !email.trim() || !phone.trim() || !password.trim()}
            />
            <PrimaryButton title="لدي حساب بالفعل" onPress={() => handleFlowChange('signin')} disabled={submitting} secondary />
            <Text style={styles.helper}>
              بعد إنشاء الحساب سنرسل رسالة تفعيل إلى البريد الإلكتروني. فعّل البريد ثم عد إلى تسجيل الدخول بالرمز.
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
              title={otpRequested ? 'تأكيد الدخول' : 'إرسال رمز التحقق'}
              onPress={otpRequested ? handleVerifyOtp : handleRequestOtp}
              disabled={submitting || !email.trim() || (otpRequested && code.trim().length < 4)}
            />

            {otpRequested ? (
              <PrimaryButton title="إعادة إرسال الرمز" onPress={handleRequestOtp} disabled={submitting} secondary />
            ) : null}

            {mode !== 'client' ? (
              <PrimaryButton
                title="إعادة إرسال رسالة التفعيل"
                onPress={handleResendActivation}
                disabled={submitting || !email.trim()}
                secondary
              />
            ) : null}

            {mode === 'office' ? (
              <Text style={styles.helper}>
                إذا كان هذا أول حساب للمكتب فاختر "تسجيل جديد". جميع أعضاء المكتب يسجّلون الدخول الآن عبر OTP على البريد.
              </Text>
            ) : mode === 'client' ? (
              <Text style={styles.helper}>
                حساب العميل يُنشأ من داخل النظام، وبعدها يدخل العميل بنفس بريده عبر رمز التحقق.
              </Text>
            ) : mode === 'partner' ? (
              <Text style={styles.helper}>
                حسابات الشركاء تُفعل من الإدارة، وبعدها يتم الدخول عبر OTP على البريد الإلكتروني.
              </Text>
            ) : (
              <Text style={styles.helper}>
                استخدم بريد الأدمن لتدخل إلى لوحة الإدارة، وبعدها تفتح أدوات الإدارة الكاملة من داخل التطبيق.
              </Text>
            )}
          </>
        )}

        {submitting ? <ActivityIndicator color={colors.primary} /> : null}
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: 180,
    height: 90,
  },
  segmentRow: {
    flexDirection: 'row-reverse',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.primary,
  },
  flowRow: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  flowChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flowChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  flowChipText: {
    color: colors.textMuted,
    fontFamily: fonts.arabicSemiBold,
    fontSize: 13,
  },
  flowChipTextActive: {
    color: colors.primary,
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
});
