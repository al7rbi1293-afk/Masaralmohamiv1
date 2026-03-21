import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthScreen } from './screens/auth';
import {
  ClientCenterScreen,
  ClientHomeScreen,
  ClientMattersScreen,
  ClientMatterDetailsScreen,
  type ClientStackParamList,
} from './screens/client';
import {
  OfficeClientsScreen,
  OfficeCalendarScreen,
  OfficeHomeScreen,
  OfficeMattersScreen,
  OfficeMatterDetailsScreen,
  OfficeClientFormScreen,
  OfficeMatterFormScreen,
  OfficeTaskFormScreen,
  OfficeDocumentFormScreen,
  OfficeBillingFormScreen,
  OfficeMoreScreen,
  type OfficeStackParamList,
} from './screens/office';
import { AdminHomeScreen, type AdminStackParamList } from './screens/admin';
import {
  PartnerCommissionsScreen,
  PartnerHomeScreen,
  PartnerProfileScreen,
} from './screens/partner';
import { useAuth } from './context/auth-context';
import { colors, fonts } from './theme';

const RootStack = createNativeStackNavigator();
const OfficeStack = createNativeStackNavigator<OfficeStackParamList>();
const ClientStack = createNativeStackNavigator<ClientStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

function AppHydrationScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        gap: 18,
      }}
    >
      <View
        style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: colors.primary,
          borderRadius: 28,
          paddingHorizontal: 24,
          paddingVertical: 28,
          gap: 12,
        }}
      >
        <Text
          style={{
            color: '#cde1da',
            fontFamily: fonts.arabicSemiBold,
            fontSize: 13,
            textAlign: 'right',
          }}
        >
          Masar Al-Muhami
        </Text>
        <Text
          style={{
            color: '#fffaf2',
            fontFamily: fonts.arabicBold,
            fontSize: 30,
            textAlign: 'right',
          }}
        >
          جارٍ تجهيز التطبيق
        </Text>
        <Text
          style={{
            color: '#d3e6e0',
            fontFamily: fonts.arabicRegular,
            fontSize: 15,
            lineHeight: 24,
            textAlign: 'right',
          }}
        >
          نعيد ربط الجلسة بنفس قاعدة البيانات والخدمات الموجودة في الموقع حتى تدخل مباشرة على بياناتك الحالية.
        </Text>
      </View>

      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

function tabLabel(label: string, focused: boolean) {
  return (
    <Text
      style={{
        color: focused ? colors.gold : colors.textMuted,
        fontFamily: focused ? fonts.arabicBold : fonts.arabicMedium,
        fontSize: 11,
      }}
    >
      {label}
    </Text>
  );
}

function OfficeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.primary,
        borderTopWidth: 0,
        height: 92,
        paddingTop: 10,
        paddingBottom: 10,
        shadowColor: colors.shadow,
        shadowOpacity: 0.12,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -6 },
        elevation: 12,
      },
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: '#b6c5c1',
      tabBarItemStyle: {
        paddingVertical: 2,
      },
    }}
  >
      <Tab.Screen
        name="OfficeHome"
        component={OfficeHomeScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('الرئيسية', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          title: 'الرئيسية',
        }}
      />
      <Tab.Screen
        name="OfficeCalendar"
        component={OfficeCalendarScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('التقويم', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
          title: 'التقويم',
        }}
      />
      <Tab.Screen
        name="OfficeMatters"
        component={OfficeMattersScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('القضايا', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
          title: 'القضايا',
        }}
      />
      <Tab.Screen
        name="OfficeClients"
        component={OfficeClientsScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('العملاء', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
          title: 'العملاء',
        }}
      />
      <Tab.Screen
        name="OfficeMore"
        component={OfficeMoreScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('التحكم', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
          title: 'التحكم',
        }}
      />
    </Tab.Navigator>
  );
}

function OfficeNavigator() {
  return (
    <OfficeStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.arabicBold, color: colors.primary },
      }}
    >
      <OfficeStack.Screen name="OfficeTabs" component={OfficeTabs} options={{ headerShown: false }} />
      <OfficeStack.Screen
        name="OfficeMatterDetails"
        component={OfficeMatterDetailsScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <OfficeStack.Screen name="OfficeClientForm" component={OfficeClientFormScreen} options={({ route }) => ({ title: route.params.mode === 'edit' ? 'تعديل عميل' : 'عميل جديد' })} />
      <OfficeStack.Screen name="OfficeMatterForm" component={OfficeMatterFormScreen} options={({ route }) => ({ title: route.params.mode === 'edit' ? 'تعديل قضية' : 'قضية جديدة' })} />
      <OfficeStack.Screen name="OfficeTaskForm" component={OfficeTaskFormScreen} options={({ route }) => ({ title: route.params.mode === 'edit' ? 'تعديل مهمة' : 'مهمة جديدة' })} />
      <OfficeStack.Screen name="OfficeDocumentForm" component={OfficeDocumentFormScreen} options={{ title: 'مستند جديد' }} />
      <OfficeStack.Screen name="OfficeBillingForm" component={OfficeBillingFormScreen} options={({ route }) => ({ title: route.params.mode === 'quote' ? 'عرض سعر' : 'فاتورة جديدة' })} />
    </OfficeStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.arabicBold, color: colors.primary },
      }}
    >
      <AdminStack.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'لوحة الإدارة' }} />
    </AdminStack.Navigator>
  );
}

function ClientTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          height: 86,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: '#b6c5c1',
      }}
    >
      <Tab.Screen
        name="ClientHome"
        component={ClientHomeScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('الرئيسية', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          title: 'الرئيسية',
        }}
      />
      <Tab.Screen
        name="ClientMatters"
        component={ClientMattersScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('القضايا', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-open-outline" size={size} color={color} />,
          title: 'القضايا',
        }}
      />
      <Tab.Screen
        name="ClientCenter"
        component={ClientCenterScreen}
        options={{
          tabBarLabel: ({ focused }) => tabLabel('الخدمات', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} />,
          title: 'مركز الخدمة',
        }}
      />
    </Tab.Navigator>
  );
}

function ClientNavigator() {
  return (
    <ClientStack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.arabicBold, color: colors.primary },
      }}
    >
      <ClientStack.Screen name="ClientTabs" component={ClientTabs} options={{ headerShown: false }} />
      <ClientStack.Screen name="ClientMatterDetails" component={ClientMatterDetailsScreen} options={{ title: 'تفاصيل القضية' }} />
    </ClientStack.Navigator>
  );
}

function PartnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.arabicBold, color: colors.primary },
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopWidth: 0,
          height: 86,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: '#b6c5c1',
      }}
    >
      <Tab.Screen
        name="PartnerHome"
        component={PartnerHomeScreen}
        options={{
          title: 'بوابة الشريك',
          tabBarLabel: ({ focused }) => tabLabel('الرئيسية', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="speedometer-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="PartnerCommissions"
        component={PartnerCommissionsScreen}
        options={{
          title: 'العمولات',
          tabBarLabel: ({ focused }) => tabLabel('العمولات', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="PartnerProfile"
        component={PartnerProfileScreen}
        options={{
          title: 'الحساب',
          tabBarLabel: ({ focused }) => tabLabel('حسابي', focused),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigation() {
  const { hydrating, session } = useAuth();

  if (hydrating) {
    return <AppHydrationScreen />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <RootStack.Screen name="Auth" component={AuthScreen} />
        ) : session.portal === 'client' ? (
          <RootStack.Screen name="Client" component={ClientNavigator} />
        ) : session.portal === 'admin' ? (
          <RootStack.Screen name="Admin" component={AdminNavigator} />
        ) : session.portal === 'partner' ? (
          <RootStack.Screen name="Partner" component={PartnerNavigator} />
        ) : (
          <RootStack.Screen name="Office" component={OfficeNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
