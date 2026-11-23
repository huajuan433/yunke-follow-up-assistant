.class public Lcom/calltimer/app/CallTimerService;
.super Landroid/app/Service;
.source "CallTimerService.java"


# annotations
.annotation system Ldalvik/annotation/MemberClasses;
    value = {
        Lcom/calltimer/app/CallTimerService$Phase;
    }
.end annotation


# static fields
.field private static final CHANNEL_ID:Ljava/lang/String; = "call_timer_channel"

.field private static final CHANNEL_WARNING:Ljava/lang/String; = "call_timer_warning"

.field private static final GRACE_MS:J = 0x1f4L

.field private static final NOTI_ID:I = 0x3e9

.field private static final NOTI_WARN_ID:I = 0x3ea

.field private static final POLL_INTERVAL_MS:J = 0x64L

.field private static final RECONCILE_INTERVAL_MS:J = 0x3e8L

.field private static final REQ_ALARM:I = 0xb

.field private static final TAG:Ljava/lang/String; = "CallTimerService"

.field public static volatile isRunning:Z

.field public static sAppContext:Landroid/content/Context;

.field public static sCallId:Ljava/lang/String;

.field public static sHBHandler:Landroid/os/Handler;

.field public static sHBStarted:Z

.field private static volatile sInstance:Lcom/calltimer/app/CallTimerService;

.field public static sPcActed:Z

.field public static sPcBaselined:Z

.field public static sPcLastId:J

.field public static sPcTicks:I

.field public static sPcWatch:Z

.field public static sRecWindowStart:J

.field public static sTalkStartWall:J


# instance fields
.field private mA11yWarned:Z

.field private mAlarmManager:Landroid/app/AlarmManager;

.field private mAlarmPi:Landroid/app/PendingIntent;

.field private mArmed:Z

.field private mCallbackToken:Ljava/lang/Object;

.field private mEverCallUi:Z

.field private final mFinalize:Ljava/lang/Runnable;

.field private mGraceScheduled:Z

.field private mLastDialingElapsed:J

.field private mLegacyListener:Landroid/telephony/PhoneStateListener;

.field private final mMain:Landroid/os/Handler;

.field private mPhase:Lcom/calltimer/app/CallTimerService$Phase;

.field private final mPoll:Ljava/lang/Runnable;

.field private mPollCount:I

.field private final mReconcile:Ljava/lang/Runnable;

.field private mRegistered:Z

.field private mSawRinging:Z

.field private mSeconds:I

.field private mStartAudioMode:I

.field private mStartElapsed:J

.field private final mTick:Ljava/lang/Runnable;

.field private mTimedOut:Z

.field private final mTimeoutByHandler:Ljava/lang/Runnable;

.field private mTm:Landroid/telephony/TelephonyManager;

.field private mWaitLock:Landroid/os/PowerManager$WakeLock;


# direct methods
.method public static synthetic $r8$lambda$5G9EHW3q82sMWSMG5ob8K6SKPW8(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onTimeout()V

    return-void
.end method

.method public static synthetic $r8$lambda$yMeWpaSIZytKpzkOCwWxfpC_kTc(Lcom/calltimer/app/CallTimerService;I)V
    .locals 0

    invoke-direct {p0, p1}, Lcom/calltimer/app/CallTimerService;->handleCallState(I)V

    return-void
.end method

.method static bridge synthetic -$$Nest$fgetmA11yWarned(Lcom/calltimer/app/CallTimerService;)Z
    .locals 0

    iget-boolean p0, p0, Lcom/calltimer/app/CallTimerService;->mA11yWarned:Z

    return p0
.end method

.method static bridge synthetic -$$Nest$fgetmArmed(Lcom/calltimer/app/CallTimerService;)Z
    .locals 0

    iget-boolean p0, p0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    return p0
.end method

.method static bridge synthetic -$$Nest$fgetmMain(Lcom/calltimer/app/CallTimerService;)Landroid/os/Handler;
    .locals 0

    iget-object p0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    return-object p0
.end method

.method static bridge synthetic -$$Nest$fgetmPhase(Lcom/calltimer/app/CallTimerService;)Lcom/calltimer/app/CallTimerService$Phase;
    .locals 0

    iget-object p0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    return-object p0
.end method

.method static bridge synthetic -$$Nest$fgetmPollCount(Lcom/calltimer/app/CallTimerService;)I
    .locals 0

    iget p0, p0, Lcom/calltimer/app/CallTimerService;->mPollCount:I

    return p0
.end method

.method static bridge synthetic -$$Nest$fgetmStartElapsed(Lcom/calltimer/app/CallTimerService;)J
    .locals 2

    iget-wide v0, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    return-wide v0
.end method

.method static bridge synthetic -$$Nest$fputmA11yWarned(Lcom/calltimer/app/CallTimerService;Z)V
    .locals 0

    iput-boolean p1, p0, Lcom/calltimer/app/CallTimerService;->mA11yWarned:Z

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmArmed(Lcom/calltimer/app/CallTimerService;Z)V
    .locals 0

    iput-boolean p1, p0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmEverCallUi(Lcom/calltimer/app/CallTimerService;Z)V
    .locals 0

    iput-boolean p1, p0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmLastDialingElapsed(Lcom/calltimer/app/CallTimerService;J)V
    .locals 0

    iput-wide p1, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmPhase(Lcom/calltimer/app/CallTimerService;Lcom/calltimer/app/CallTimerService$Phase;)V
    .locals 0

    iput-object p1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmPollCount(Lcom/calltimer/app/CallTimerService;I)V
    .locals 0

    iput p1, p0, Lcom/calltimer/app/CallTimerService;->mPollCount:I

    return-void
.end method

.method static bridge synthetic -$$Nest$fputmSawRinging(Lcom/calltimer/app/CallTimerService;Z)V
    .locals 0

    iput-boolean p1, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    return-void
.end method

.method static bridge synthetic -$$Nest$mbuildNotification(Lcom/calltimer/app/CallTimerService;)Landroid/app/Notification;
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->buildNotification()Landroid/app/Notification;

    move-result-object p0

    return-object p0
.end method

.method static bridge synthetic -$$Nest$menterConnected(Lcom/calltimer/app/CallTimerService;Z)V
    .locals 0

    invoke-direct {p0, p1}, Lcom/calltimer/app/CallTimerService;->enterConnected(Z)V

    return-void
.end method

.method static bridge synthetic -$$Nest$mfinalizeHangup(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->finalizeHangup()V

    return-void
.end method

.method static bridge synthetic -$$Nest$mhandleCallState(Lcom/calltimer/app/CallTimerService;I)V
    .locals 0

    invoke-direct {p0, p1}, Lcom/calltimer/app/CallTimerService;->handleCallState(I)V

    return-void
.end method

.method static bridge synthetic -$$Nest$mnotifyA11yWarning(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->notifyA11yWarning()V

    return-void
.end method

.method static bridge synthetic -$$Nest$mnotifyHangupFailed(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->notifyHangupFailed()V

    return-void
.end method

.method static bridge synthetic -$$Nest$monIdle(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onIdle()V

    return-void
.end method

.method static bridge synthetic -$$Nest$monOffhook(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onOffhook()V

    return-void
.end method

.method static bridge synthetic -$$Nest$monTimeout(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onTimeout()V

    return-void
.end method

.method static bridge synthetic -$$Nest$mreadCallState(Lcom/calltimer/app/CallTimerService;)I
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->readCallState()I

    move-result p0

    return p0
.end method

.method static bridge synthetic -$$Nest$mrefreshNotification(Lcom/calltimer/app/CallTimerService;)V
    .locals 0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    return-void
.end method

.method static constructor <clinit>()V
    .locals 0

    return-void
.end method

.method public constructor <init>()V
    .locals 3

    .line 34
    invoke-direct {p0}, Landroid/app/Service;-><init>()V

    const/4 v0, 0x0

    .line 55
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    .line 60
    new-instance v1, Landroid/os/Handler;

    invoke-static {}, Landroid/os/Looper;->getMainLooper()Landroid/os/Looper;

    move-result-object v2

    invoke-direct {v1, v2}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V

    iput-object v1, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    .line 62
    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->IDLE:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    .line 63
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    .line 64
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    .line 65
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mGraceScheduled:Z

    .line 67
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    .line 69
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    .line 71
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mA11yWarned:Z

    const/4 v1, -0x1

    .line 73
    iput v1, p0, Lcom/calltimer/app/CallTimerService;->mStartAudioMode:I

    const-wide/16 v1, 0x0

    .line 74
    iput-wide v1, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    .line 76
    iput-wide v1, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    const/16 v1, 0x1e

    .line 77
    iput v1, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    .line 82
    new-instance v1, Lcom/calltimer/app/CallTimerService$1;

    invoke-direct {v1, p0}, Lcom/calltimer/app/CallTimerService$1;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTimeoutByHandler:Ljava/lang/Runnable;

    .line 90
    new-instance v1, Lcom/calltimer/app/CallTimerService$2;

    invoke-direct {v1, p0}, Lcom/calltimer/app/CallTimerService$2;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v1, p0, Lcom/calltimer/app/CallTimerService;->mFinalize:Ljava/lang/Runnable;

    .line 98
    iput v0, p0, Lcom/calltimer/app/CallTimerService;->mPollCount:I

    .line 104
    new-instance v0, Lcom/calltimer/app/CallTimerService$3;

    invoke-direct {v0, p0}, Lcom/calltimer/app/CallTimerService$3;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPoll:Ljava/lang/Runnable;

    .line 138
    new-instance v0, Lcom/calltimer/app/CallTimerService$4;

    invoke-direct {v0, p0}, Lcom/calltimer/app/CallTimerService$4;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mTick:Ljava/lang/Runnable;

    .line 153
    new-instance v0, Lcom/calltimer/app/CallTimerService$5;

    invoke-direct {v0, p0}, Lcom/calltimer/app/CallTimerService$5;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mReconcile:Ljava/lang/Runnable;

    return-void
.end method

.method private acquireWaitLock()V
    .locals 5

    .line 626
    :try_start_0
    const-string v0, "power"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/os/PowerManager;

    if-nez v0, :cond_0

    return-void

    .line 628
    :cond_0
    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    if-nez v1, :cond_1

    .line 629
    const-string v1, "calltimer:wait-pickup"

    const/4 v2, 0x1

    invoke-virtual {v0, v2, v1}, Landroid/os/PowerManager;->newWakeLock(ILjava/lang/String;)Landroid/os/PowerManager$WakeLock;

    move-result-object v0

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    .line 631
    :cond_1
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    invoke-virtual {v0}, Landroid/os/PowerManager$WakeLock;->isHeld()Z

    move-result v0

    if-nez v0, :cond_2

    .line 632
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    iget v1, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    add-int/lit8 v1, v1, 0xf

    int-to-long v1, v1

    const-wide/16 v3, 0x3e8

    mul-long/2addr v1, v3

    invoke-virtual {v0, v1, v2}, Landroid/os/PowerManager$WakeLock;->acquire(J)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    move-exception v0

    .line 635
    const-string v1, "CallTimerService"

    const-string v2, "acquireWaitLock failed"

    invoke-static {v1, v2, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    :cond_2
    :goto_0
    return-void
.end method

.method private buildNotification()Landroid/app/Notification;
    .locals 7

    .line 318
    new-instance v0, Landroid/content/Intent;

    const-class v1, Lcom/calltimer/app/MainActivity;

    invoke-direct {v0, p0, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    const/high16 v1, 0x20000000

    .line 319
    invoke-virtual {v0, v1}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;

    const/4 v1, 0x0

    const/high16 v2, 0xc000000

    .line 320
    invoke-static {p0, v1, v0, v2}, Landroid/app/PendingIntent;->getActivity(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;

    move-result-object v0

    .line 324
    sget-object v1, Lcom/calltimer/app/CallTimerService$8;->$SwitchMap$com$calltimer$app$CallTimerService$Phase:[I

    iget-object v2, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    invoke-virtual {v2}, Lcom/calltimer/app/CallTimerService$Phase;->ordinal()I

    move-result v2

    aget v1, v1, v2

    const/4 v2, 0x1

    if-eq v1, v2, :cond_2

    const/4 v3, 0x2

    if-eq v1, v3, :cond_1

    .line 339
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->isReady()Z

    move-result v1

    if-nez v1, :cond_0

    .line 340
    sget v1, Lcom/calltimer/app/R$string;->noti_need_a11y:I

    invoke-virtual {p0, v1}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v1

    goto :goto_0

    .line 342
    :cond_0
    sget v1, Lcom/calltimer/app/R$string;->noti_idle:I

    iget v3, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    invoke-static {v3}, Ljava/lang/Integer;->valueOf(I)Ljava/lang/Integer;

    move-result-object v3

    filled-new-array {v3}, [Ljava/lang/Object;

    move-result-object v3

    invoke-virtual {p0, v1, v3}, Lcom/calltimer/app/CallTimerService;->getString(I[Ljava/lang/Object;)Ljava/lang/String;

    move-result-object v1

    goto :goto_0

    .line 335
    :cond_1
    sget v1, Lcom/calltimer/app/R$string;->noti_connected:I

    invoke-virtual {p0, v1}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v1

    goto :goto_0

    .line 326
    :cond_2
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->isShowCountdown(Landroid/content/Context;)Z

    move-result v1

    if-eqz v1, :cond_3

    .line 327
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v3

    iget-wide v5, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    sub-long/2addr v3, v5

    const-wide/16 v5, 0x3e8

    div-long/2addr v3, v5

    .line 328
    iget v1, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    int-to-long v5, v1

    sub-long/2addr v5, v3

    const-wide/16 v3, 0x0

    invoke-static {v3, v4, v5, v6}, Ljava/lang/Math;->max(JJ)J

    move-result-wide v3

    .line 329
    sget v1, Lcom/calltimer/app/R$string;->noti_waiting_countdown:I

    invoke-static {v3, v4}, Ljava/lang/Long;->valueOf(J)Ljava/lang/Long;

    move-result-object v3

    filled-new-array {v3}, [Ljava/lang/Object;

    move-result-object v3

    invoke-virtual {p0, v1, v3}, Lcom/calltimer/app/CallTimerService;->getString(I[Ljava/lang/Object;)Ljava/lang/String;

    move-result-object v1

    goto :goto_0

    .line 331
    :cond_3
    sget v1, Lcom/calltimer/app/R$string;->noti_waiting_silent:I

    invoke-virtual {p0, v1}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v1

    .line 349
    :goto_0
    new-instance v3, Landroid/app/Notification$Builder;

    const-string v4, "call_timer_channel"

    invoke-direct {v3, p0, v4}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;Ljava/lang/String;)V

    .line 353
    sget v4, Lcom/calltimer/app/R$drawable;->ic_notification:I

    invoke-virtual {v3, v4}, Landroid/app/Notification$Builder;->setSmallIcon(I)Landroid/app/Notification$Builder;

    move-result-object v3

    sget v4, Lcom/calltimer/app/R$string;->app_name:I

    .line 354
    invoke-virtual {p0, v4}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v4

    invoke-virtual {v3, v4}, Landroid/app/Notification$Builder;->setContentTitle(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v3

    .line 355
    invoke-virtual {v3, v1}, Landroid/app/Notification$Builder;->setContentText(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v1

    .line 356
    invoke-virtual {v1, v2}, Landroid/app/Notification$Builder;->setOngoing(Z)Landroid/app/Notification$Builder;

    move-result-object v1

    .line 357
    invoke-virtual {v1, v2}, Landroid/app/Notification$Builder;->setOnlyAlertOnce(Z)Landroid/app/Notification$Builder;

    move-result-object v1

    const/4 v2, -0x1

    .line 358
    invoke-virtual {v1, v2}, Landroid/app/Notification$Builder;->setPriority(I)Landroid/app/Notification$Builder;

    move-result-object v1

    .line 359
    invoke-virtual {v1, v0}, Landroid/app/Notification$Builder;->setContentIntent(Landroid/app/PendingIntent;)Landroid/app/Notification$Builder;

    move-result-object v0

    .line 360
    invoke-virtual {v0}, Landroid/app/Notification$Builder;->build()Landroid/app/Notification;

    move-result-object v0

    return-object v0
.end method

.method private cancelScheduledHangup()V
    .locals 2

    .line 702
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTimeoutByHandler:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 703
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mFinalize:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 704
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPoll:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 705
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTick:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    const/4 v0, 0x0

    .line 706
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mGraceScheduled:Z

    .line 708
    :try_start_0
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mAlarmPi:Landroid/app/PendingIntent;

    invoke-virtual {v0, v1}, Landroid/app/AlarmManager;->cancel(Landroid/app/PendingIntent;)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :catchall_0
    return-void
.end method

.method private createChannel()V
    .locals 6

    .line 271
    const-string v0, "notification"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/NotificationManager;

    if-nez v0, :cond_0

    return-void

    .line 273
    :cond_0
    new-instance v1, Landroid/app/NotificationChannel;

    sget v2, Lcom/calltimer/app/R$string;->channel_name:I

    .line 274
    invoke-virtual {p0, v2}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v2

    const/4 v3, 0x2

    const-string v4, "call_timer_channel"

    invoke-direct {v1, v4, v2, v3}, Landroid/app/NotificationChannel;-><init>(Ljava/lang/String;Ljava/lang/CharSequence;I)V

    .line 275
    sget v2, Lcom/calltimer/app/R$string;->channel_desc:I

    invoke-virtual {p0, v2}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v2

    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->setDescription(Ljava/lang/String;)V

    const/4 v2, 0x0

    .line 276
    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->setShowBadge(Z)V

    const/4 v3, 0x0

    .line 277
    invoke-virtual {v1, v3, v3}, Landroid/app/NotificationChannel;->setSound(Landroid/net/Uri;Landroid/media/AudioAttributes;)V

    .line 278
    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->enableVibration(Z)V

    .line 279
    invoke-virtual {v0, v1}, Landroid/app/NotificationManager;->createNotificationChannel(Landroid/app/NotificationChannel;)V

    .line 282
    new-instance v1, Landroid/app/NotificationChannel;

    const-string v2, "call_timer_warning"

    const-string v4, "\u5f02\u5e38\u63d0\u9192"

    const/4 v5, 0x4

    invoke-direct {v1, v2, v4, v5}, Landroid/app/NotificationChannel;-><init>(Ljava/lang/String;Ljava/lang/CharSequence;I)V

    .line 284
    const-string v2, "\u65e0\u969c\u788d\u88ab\u5173\u95ed\u7b49\u5bfc\u81f4\u529f\u80fd\u5931\u6548\u65f6\u7684\u63d0\u9192"

    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->setDescription(Ljava/lang/String;)V

    .line 285
    invoke-virtual {v1, v3, v3}, Landroid/app/NotificationChannel;->setSound(Landroid/net/Uri;Landroid/media/AudioAttributes;)V

    const/4 v2, 0x1

    .line 286
    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->enableVibration(Z)V

    .line 287
    new-array v3, v5, [J

    fill-array-data v3, :array_0

    invoke-virtual {v1, v3}, Landroid/app/NotificationChannel;->setVibrationPattern([J)V

    .line 288
    invoke-virtual {v1, v2}, Landroid/app/NotificationChannel;->setShowBadge(Z)V

    .line 289
    invoke-virtual {v0, v1}, Landroid/app/NotificationManager;->createNotificationChannel(Landroid/app/NotificationChannel;)V

    return-void

    nop

    :array_0
    .array-data 8
        0x0
        0x78
        0x78
        0x78
    .end array-data
.end method

.method private enterConnected(Z)V
    .locals 4

    .line 476
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->WAITING:Lcom/calltimer/app/CallTimerService$Phase;

    if-eq v0, v1, :cond_0

    return-void

    .line 477
    :cond_0
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    :try_start_0
    invoke-static {}, Lcom/calltimer/app/HangupReporter;->ykMarkConnected()V

    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->ykAnswered(Ljava/lang/String;)V

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sput-wide v0, Lcom/calltimer/app/CallTimerService;->sTalkStartWall:J
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    const-string v0, "enterConnected yk error"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    :goto_0
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->startPcWatch()V

    .line 478
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->cancelScheduledHangup()V

    # 接通后只取消未接通倒计时；mSeconds 仅用于拨出后等待接通，绝不作为通话时长上限。
    const-string v0, "[yk] connected; no talk timeout"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 480
    :cond_1
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v0

    iget-wide v2, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    sub-long/2addr v0, v2

    const-wide/16 v2, 0x3e8

    div-long/2addr v0, v2

    const-wide/16 v2, 0x0

    .line 479
    invoke-static {v2, v3, v0, v1}, Ljava/lang/Math;->max(JJ)J

    move-result-wide v0

    long-to-int v0, v0

    if-nez p1, :cond_2

    const/4 p1, 0x1

    .line 482
    invoke-static {p0, v0, p1}, Lcom/calltimer/app/WaitStatsStore;->record(Landroid/content/Context;IZ)V

    .line 483
    new-instance p1, Ljava/lang/StringBuilder;

    const-string v1, "connected after "

    invoke-direct {p1, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {p1, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object p1

    const-string v1, "s, hangup cancelled"

    invoke-virtual {p1, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p1

    const-string v2, "CallTimerService"

    invoke-static {v2, p1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 484
    new-instance p1, Ljava/lang/StringBuilder;

    const-string v2, "CONNECTED after "

    invoke-direct {p1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {p1, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object p1

    invoke-virtual {p1, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object p1

    invoke-virtual {p1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p1

    invoke-static {p1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    goto :goto_1

    .line 486
    :cond_2
    const-string p1, "CANCEL hangup for safety (accessibility lost)"

    invoke-static {p1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 488
    :goto_1
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->releaseWaitLock()V

    .line 489
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    return-void
.end method

.method private finalizeHangup()V
    .locals 11

    .line 527
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->WAITING:Lcom/calltimer/app/CallTimerService$Phase;

    if-ne v0, v1, :cond_f

    iget-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    if-eqz v0, :cond_0

    goto/16 :goto_3

    .line 530
    :cond_0
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->readCallState()I

    move-result v0

    if-nez v0, :cond_1

    .line 532
    const-string v0, "finalize: physical IDLE, reset"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 533
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onIdle()V

    return-void

    .line 538
    :cond_1
    invoke-static {p0}, Lcom/calltimer/app/CallSignals;->micActive(Landroid/content/Context;)Z

    move-result v1

    const/4 v2, 0x0

    if-eqz v1, :cond_3

    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->scanNow()Lcom/calltimer/app/HangupAccessibilityService$ScanResult;

    move-result-object v1

    if-eqz v1, :cond_2

    iget-boolean v3, v1, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->connected:Z

    if-eqz v3, :cond_2

    const-string v0, "finalize: mic active, keep call"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 540
    invoke-direct {p0, v2}, Lcom/calltimer/app/CallTimerService;->enterConnected(Z)V

    return-void

    :cond_2
    const-string v3, "[yk] finalize: mic active but scan uncertain; keep call"

    invoke-static {v3}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    # 麦克风已激活但界面识别不确定时，按可能已接通处理；绝不因一次漏识别而挂断真人通话。
    return-void

    .line 545
    :cond_3
    invoke-static {p0}, Lcom/calltimer/app/CallSignals;->audio(Landroid/content/Context;)I

    move-result v1

    .line 546
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->scanNow()Lcom/calltimer/app/HangupAccessibilityService$ScanResult;

    move-result-object v3

    const/4 v4, 0x1

    if-eqz v3, :cond_6

    .line 548
    iget-boolean v5, v3, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->callUiVisible:Z

    if-eqz v5, :cond_4

    iput-boolean v4, p0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    .line 549
    :cond_4
    iget-boolean v5, v3, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->connected:Z

    if-eqz v5, :cond_5

    .line 550
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v1, "finalize: UI connected, keep: "

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 551
    invoke-direct {p0, v2}, Lcom/calltimer/app/CallTimerService;->enterConnected(Z)V

    return-void

    .line 554
    :cond_5
    iget-boolean v5, v3, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->busy:Z

    if-eqz v5, :cond_6

    invoke-static {p0}, Lcom/calltimer/app/CallTimerService;->-$$Nest$mreadCallState(Lcom/calltimer/app/CallTimerService;)I

    move-result v0

    invoke-static {p0}, Lcom/calltimer/app/CallSignals;->audio(Landroid/content/Context;)I

    move-result v1

    const-string v5, "[yk] busy (off/busy) -> hangup now"

    invoke-static {v5}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    goto :goto_1

    .line 568
    :cond_6
    iget-wide v5, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    const-wide/16 v7, 0x0

    cmp-long v5, v5, v7

    if-nez v5, :cond_7

    const-wide/16 v5, -0x1

    goto :goto_0

    .line 569
    :cond_7
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v5

    iget-wide v9, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    sub-long/2addr v5, v9

    :goto_0
    if-eqz v3, :cond_8

    .line 570
    iget-boolean v9, v3, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->dialing:Z

    if-nez v9, :cond_9

    :cond_8
    iget-wide v9, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    cmp-long v9, v9, v7

    if-eqz v9, :cond_d

    cmp-long v7, v5, v7

    if-ltz v7, :cond_d

    const-wide/16 v7, 0x1f40

    cmp-long v7, v5, v7

    if-gez v7, :cond_d

    .line 583
    :cond_9
    :goto_1
    iput-boolean v4, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    .line 584
    iget v4, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    invoke-static {p0, v4, v2}, Lcom/calltimer/app/WaitStatsStore;->record(Landroid/content/Context;IZ)V

    .line 585
    new-instance v2, Ljava/lang/StringBuilder;

    const-string v4, "timeout still ringing -> hangup, callState="

    invoke-direct {v2, v4}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v4, " audio="

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2, v1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    const-string v5, "CallTimerService"

    invoke-static {v5, v2}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 586
    new-instance v2, Ljava/lang/StringBuilder;

    const-string v5, "TIMEOUT ringing -> HANGUP decision (callState="

    invoke-direct {v2, v5}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, " scan="

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, ")"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    const-wide/16 v0, 0xc8

    invoke-static {v0, v1}, Landroid/os/SystemClock;->sleep(J)V

    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->scanNow()Lcom/calltimer/app/HangupAccessibilityService$ScanResult;

    move-result-object v0

    if-eqz v0, :cond_b

    iget-boolean v1, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->connected:Z

    if-eqz v1, :cond_a

    const-string v0, "recheck: connected appeared, hangup cancelled"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    return-void

    :cond_a
    iget-object v1, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->timerCandidates:Ljava/util/List;

    if-eqz v1, :cond_b

    invoke-interface {v1}, Ljava/util/List;->isEmpty()Z

    move-result v1

    if-nez v1, :cond_b

    iget-boolean v1, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->dialing:Z

    if-nez v1, :cond_b

    const-string v0, "recheck: timer visible not dialing, hangup cancelled"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    return-void

    .line 588
    :cond_b
    const-string v0, "\u672a\u63a5\u901a\uff0c\u6b63\u5728\u81ea\u52a8\u6302\u65ad\u2026"

    invoke-direct {p0, v0}, Lcom/calltimer/app/CallTimerService;->notifyText(Ljava/lang/String;)V

    .line 589
    new-instance v0, Lcom/calltimer/app/CallTimerService$7;

    invoke-direct {v0, p0}, Lcom/calltimer/app/CallTimerService$7;-><init>(Lcom/calltimer/app/CallTimerService;)V

    sget-object v1, Lcom/calltimer/app/HangupAccessibilityService;->sBusyReason:Ljava/lang/String;

    if-eqz v1, :cond_c

    invoke-static {v1}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    goto :goto_2

    :cond_c
    const-string v1, "timeout"

    invoke-static {v1}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    :goto_2
    sget-object v1, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v1}, Lcom/calltimer/app/HangupReporter;->report(Ljava/lang/String;)V

    invoke-static {p0, v0}, Lcom/calltimer/app/HangupController;->run(Landroid/content/Context;Ljava/lang/Runnable;)V

    return-void

    .line 573
    :cond_d
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v1, "finalize: unclear state (dialingAge="

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0, v5, v6}, Ljava/lang/StringBuilder;->append(J)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, "ms), safe keep; scan="

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    if-eqz v3, :cond_e

    iget-boolean v10, v3, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->callUiVisible:Z

    if-nez v10, :cond_e

    const-string v10, "unclear"

    invoke-static {v10}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    sget-object v10, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v10}, Lcom/calltimer/app/HangupReporter;->report(Ljava/lang/String;)V

    .line 575
    :cond_e
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sput-wide v0, Lcom/calltimer/app/CallTimerService;->sTalkStartWall:J

    .line 576
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->cancelScheduledHangup()V

    .line 577
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->releaseWaitLock()V

    .line 578
    const-string v0, "\u72b6\u6001\u4e0d\u660e\uff0c\u672c\u6b21\u672a\u81ea\u52a8\u6302\u65ad\uff0c\u8bf7\u628a\u81ea\u68c0\u65e5\u5fd7\u53d1\u6211"

    invoke-direct {p0, v0}, Lcom/calltimer/app/CallTimerService;->notifyText(Ljava/lang/String;)V

    :cond_f
    :goto_3
    return-void
.end method

.method public static getDebugSnapshot(Landroid/content/Context;)Ljava/lang/String;
    .locals 5

    .line 734
    sget-object v0, Lcom/calltimer/app/CallTimerService;->sInstance:Lcom/calltimer/app/CallTimerService;

    .line 735
    new-instance v1, Ljava/lang/StringBuilder;

    const-string v2, "\u670d\u52a1\u8fdb\u7a0b\u5b58\u6d3b: "

    invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    if-eqz v0, :cond_0

    const/4 v2, 0x1

    goto :goto_0

    :cond_0
    const/4 v2, 0x0

    .line 736
    :goto_0
    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "\n\u65e0\u969c\u788d\u5df2\u8fde\u63a5: "

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    .line 737
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->isReady()Z

    move-result v2

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "\n\u603b\u5f00\u5173: "

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    .line 738
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->isEnabled(Landroid/content/Context;)Z

    move-result v2

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v3, "\n\u7b49\u5f85\u79d2\u6570: "

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    .line 739
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->getSeconds(Landroid/content/Context;)I

    move-result v2

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v2

    const/16 v3, 0xa

    invoke-virtual {v2, v3}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;

    if-eqz v0, :cond_1

    .line 741
    const-string v2, "\u72b6\u6001\u673a: phase="

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    iget-object v4, v0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v4, " armed="

    .line 742
    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    iget-boolean v4, v0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v4, " \u72b6\u6001\u76d1\u542c="

    .line 743
    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    iget-boolean v4, v0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v2

    const-string v4, " \u89c1\u8fc7\u901a\u8bdd\u754c\u9762="

    .line 744
    invoke-virtual {v2, v4}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    iget-boolean v0, v0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0, v3}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;

    .line 747
    :cond_1
    :try_start_0
    const-string v0, "power"

    invoke-virtual {p0, v0}, Landroid/content/Context;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/os/PowerManager;

    if-eqz v0, :cond_2

    .line 749
    const-string v2, "\u7535\u6c60\u4f18\u5316\u767d\u540d\u5355: "

    invoke-virtual {v1, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v2

    .line 750
    invoke-virtual {p0}, Landroid/content/Context;->getPackageName()Ljava/lang/String;

    move-result-object v4

    invoke-virtual {v0, v4}, Landroid/os/PowerManager;->isIgnoringBatteryOptimizations(Ljava/lang/String;)Z

    move-result v0

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v0

    .line 751
    invoke-virtual {v0, v3}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;

    .line 753
    :cond_2
    const-string v0, "alarm"

    invoke-virtual {p0, v0}, Landroid/content/Context;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object p0

    check-cast p0, Landroid/app/AlarmManager;

    .line 754
    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1f

    if-lt v0, v2, :cond_3

    if-eqz p0, :cond_3

    .line 755
    const-string v0, "\u7cbe\u786e\u95f9\u949f\u6743\u9650: "

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {p0}, Landroid/app/AlarmManager;->canScheduleExactAlarms()Z

    move-result p0

    invoke-virtual {v0, p0}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object p0

    invoke-virtual {p0, v3}, Ljava/lang/StringBuilder;->append(C)Ljava/lang/StringBuilder;
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    .line 759
    :catchall_0
    :cond_3
    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object p0

    return-object p0
.end method

.method public static getPhase()Lcom/calltimer/app/CallTimerService$Phase;
    .locals 1

    sget-object v0, Lcom/calltimer/app/CallTimerService;->sInstance:Lcom/calltimer/app/CallTimerService;

    if-eqz v0, :cond_0

    iget-object v0, v0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    return-object v0

    :cond_0
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->IDLE:Lcom/calltimer/app/CallTimerService$Phase;

    return-object v0
.end method

.method private handleCallState(I)V
    .locals 2

    .line 394
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v1, "call state -> "

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, ", phase="

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    const-string v1, "CallTimerService"

    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    const/4 v0, 0x1

    if-ne p1, v0, :cond_0

    .line 396
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    return-void

    :cond_0
    const/4 v0, 0x2

    if-ne p1, v0, :cond_1

    .line 400
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onOffhook()V

    goto :goto_0

    :cond_1
    if-nez p1, :cond_2

    .line 402
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onIdle()V

    :cond_2
    :goto_0
    return-void
.end method

.method private notifyA11yWarning()V
    .locals 5

    .line 294
    const-string v0, "notification"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/NotificationManager;

    if-nez v0, :cond_0

    return-void

    .line 296
    :cond_0
    new-instance v1, Landroid/content/Intent;

    const-string v2, "android.settings.ACCESSIBILITY_SETTINGS"

    invoke-direct {v1, v2}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V

    const/high16 v2, 0x10000000

    .line 297
    invoke-virtual {v1, v2}, Landroid/content/Intent;->addFlags(I)Landroid/content/Intent;

    move-result-object v1

    const/4 v2, 0x2

    const/high16 v3, 0xc000000

    .line 298
    invoke-static {p0, v2, v1, v3}, Landroid/app/PendingIntent;->getActivity(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;

    move-result-object v1

    .line 302
    new-instance v2, Landroid/app/Notification$Builder;

    const-string v3, "call_timer_warning"

    invoke-direct {v2, p0, v3}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;Ljava/lang/String;)V

    .line 306
    sget v3, Lcom/calltimer/app/R$drawable;->ic_notification:I

    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setSmallIcon(I)Landroid/app/Notification$Builder;

    move-result-object v2

    const-string v3, "\u5b9a\u65f6\u6302\u65ad\uff1a\u65e0\u969c\u788d\u670d\u52a1\u672a\u5f00\u542f"

    .line 307
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentTitle(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    const-string v3, "\u81ea\u52a8\u6302\u65ad\u4e0d\u4f1a\u5de5\u4f5c\uff0c\u70b9\u6b64\u53bb\u5f00\u542f\u201c\u5b9a\u65f6\u6302\u65ad-\u63a5\u901a\u8bc6\u522b\u4e0e\u6302\u65ad\u201d"

    .line 308
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentText(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    new-instance v3, Landroid/app/Notification$BigTextStyle;

    invoke-direct {v3}, Landroid/app/Notification$BigTextStyle;-><init>()V

    const-string v4, "\u68c0\u6d4b\u5230\u65e0\u969c\u788d\u670d\u52a1\u88ab\u5173\u95ed\uff08MIUI \u5e38\u4f1a\u81ea\u52a8\u5173\u95ed\uff09\uff0c\u672a\u63a5\u901a\u81ea\u52a8\u6302\u65ad\u4e0d\u4f1a\u5de5\u4f5c\u3002\u70b9\u6b64\u5230\u65e0\u969c\u788d\u8bbe\u7f6e\u91cd\u65b0\u5f00\u542f\uff0c\u5e76\u5728\u6700\u8fd1\u4efb\u52a1\u91cc\u9501\u5b9a\u672c\u5e94\u7528\u3001\u7535\u6c60\u7b56\u7565\u8bbe\u4e3a\u65e0\u9650\u5236\u3002"

    .line 309
    invoke-virtual {v3, v4}, Landroid/app/Notification$BigTextStyle;->bigText(Ljava/lang/CharSequence;)Landroid/app/Notification$BigTextStyle;

    move-result-object v3

    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setStyle(Landroid/app/Notification$Style;)Landroid/app/Notification$Builder;

    move-result-object v2

    const/4 v3, 0x1

    .line 311
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setAutoCancel(Z)Landroid/app/Notification$Builder;

    move-result-object v2

    .line 312
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setPriority(I)Landroid/app/Notification$Builder;

    move-result-object v2

    .line 313
    invoke-virtual {v2, v1}, Landroid/app/Notification$Builder;->setContentIntent(Landroid/app/PendingIntent;)Landroid/app/Notification$Builder;

    move-result-object v1

    .line 314
    invoke-virtual {v1}, Landroid/app/Notification$Builder;->build()Landroid/app/Notification;

    move-result-object v1

    const/16 v2, 0x3ea

    .line 306
    invoke-virtual {v0, v2, v1}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V

    return-void
.end method

.method private notifyHangupFailed()V
    .locals 4

    .line 603
    const-string v0, "notification"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/NotificationManager;

    if-nez v0, :cond_0

    return-void

    .line 605
    :cond_0
    new-instance v1, Landroid/content/Intent;

    const-class v2, Lcom/calltimer/app/MainActivity;

    invoke-direct {v1, p0, v2}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    const/4 v2, 0x3

    const/high16 v3, 0xc000000

    .line 606
    invoke-static {p0, v2, v1, v3}, Landroid/app/PendingIntent;->getActivity(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;

    move-result-object v1

    .line 610
    new-instance v2, Landroid/app/Notification$Builder;

    const-string v3, "call_timer_warning"

    invoke-direct {v2, p0, v3}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;Ljava/lang/String;)V

    .line 614
    sget v3, Lcom/calltimer/app/R$drawable;->ic_notification:I

    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setSmallIcon(I)Landroid/app/Notification$Builder;

    move-result-object v2

    const-string v3, "\u81ea\u52a8\u6302\u65ad\u5931\u8d25\uff0c\u8bf7\u624b\u52a8\u6302\u65ad"

    .line 615
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentTitle(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    const-string v3, "\u7cfb\u7edf\u63a5\u53e3\u4e0e\u65e0\u969c\u788d\u70b9\u51fb\u5747\u672a\u6210\u529f\uff0c\u8bf7\u624b\u52a8\u70b9\u6302\u65ad"

    .line 616
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentText(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    const/4 v3, 0x1

    .line 617
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setAutoCancel(Z)Landroid/app/Notification$Builder;

    move-result-object v2

    .line 618
    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setPriority(I)Landroid/app/Notification$Builder;

    move-result-object v2

    .line 619
    invoke-virtual {v2, v1}, Landroid/app/Notification$Builder;->setContentIntent(Landroid/app/PendingIntent;)Landroid/app/Notification$Builder;

    move-result-object v1

    .line 620
    invoke-virtual {v1}, Landroid/app/Notification$Builder;->build()Landroid/app/Notification;

    move-result-object v1

    const/16 v2, 0x3ea

    .line 614
    invoke-virtual {v0, v2, v1}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V

    return-void
.end method

.method private notifyText(Ljava/lang/String;)V
    .locals 4

    .line 648
    const-string v0, "notification"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/NotificationManager;

    if-nez v0, :cond_0

    return-void

    .line 650
    :cond_0
    new-instance v1, Landroid/content/Intent;

    const-class v2, Lcom/calltimer/app/MainActivity;

    invoke-direct {v1, p0, v2}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    const/4 v2, 0x0

    const/high16 v3, 0xc000000

    .line 651
    invoke-static {p0, v2, v1, v3}, Landroid/app/PendingIntent;->getActivity(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;

    move-result-object v1

    .line 655
    new-instance v2, Landroid/app/Notification$Builder;

    const-string v3, "call_timer_channel"

    invoke-direct {v2, p0, v3}, Landroid/app/Notification$Builder;-><init>(Landroid/content/Context;Ljava/lang/String;)V

    .line 659
    sget v3, Lcom/calltimer/app/R$drawable;->ic_notification:I

    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setSmallIcon(I)Landroid/app/Notification$Builder;

    move-result-object v2

    sget v3, Lcom/calltimer/app/R$string;->app_name:I

    .line 660
    invoke-virtual {p0, v3}, Lcom/calltimer/app/CallTimerService;->getString(I)Ljava/lang/String;

    move-result-object v3

    invoke-virtual {v2, v3}, Landroid/app/Notification$Builder;->setContentTitle(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    .line 661
    invoke-virtual {v2, p1}, Landroid/app/Notification$Builder;->setContentText(Ljava/lang/CharSequence;)Landroid/app/Notification$Builder;

    move-result-object v2

    new-instance v3, Landroid/app/Notification$BigTextStyle;

    invoke-direct {v3}, Landroid/app/Notification$BigTextStyle;-><init>()V

    .line 662
    invoke-virtual {v3, p1}, Landroid/app/Notification$BigTextStyle;->bigText(Ljava/lang/CharSequence;)Landroid/app/Notification$BigTextStyle;

    move-result-object p1

    invoke-virtual {v2, p1}, Landroid/app/Notification$Builder;->setStyle(Landroid/app/Notification$Style;)Landroid/app/Notification$Builder;

    move-result-object p1

    const/4 v2, 0x1

    .line 663
    invoke-virtual {p1, v2}, Landroid/app/Notification$Builder;->setOngoing(Z)Landroid/app/Notification$Builder;

    move-result-object p1

    .line 664
    invoke-virtual {p1, v2}, Landroid/app/Notification$Builder;->setOnlyAlertOnce(Z)Landroid/app/Notification$Builder;

    move-result-object p1

    const/4 v2, -0x1

    .line 665
    invoke-virtual {p1, v2}, Landroid/app/Notification$Builder;->setPriority(I)Landroid/app/Notification$Builder;

    move-result-object p1

    .line 666
    invoke-virtual {p1, v1}, Landroid/app/Notification$Builder;->setContentIntent(Landroid/app/PendingIntent;)Landroid/app/Notification$Builder;

    move-result-object p1

    .line 667
    invoke-virtual {p1}, Landroid/app/Notification$Builder;->build()Landroid/app/Notification;

    move-result-object p1

    const/16 v1, 0x3e9

    .line 659
    invoke-virtual {v0, v1, p1}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V

    return-void
.end method

.method public static onAlarmFired(Landroid/content/Context;)V
    .locals 2

    .line 672
    sget-object p0, Lcom/calltimer/app/CallTimerService;->sInstance:Lcom/calltimer/app/CallTimerService;

    if-eqz p0, :cond_0

    .line 674
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    invoke-static {p0}, Ljava/util/Objects;->requireNonNull(Ljava/lang/Object;)Ljava/lang/Object;

    new-instance v1, Lcom/calltimer/app/CallTimerService$$ExternalSyntheticLambda0;

    invoke-direct {v1, p0}, Lcom/calltimer/app/CallTimerService$$ExternalSyntheticLambda0;-><init>(Lcom/calltimer/app/CallTimerService;)V

    invoke-virtual {v0, v1}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    goto :goto_0

    .line 676
    :cond_0
    const-string p0, "CallTimerService"

    const-string v0, "alarm fired but service gone, skip hangup for safety"

    invoke-static {p0, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;)I

    :goto_0
    return-void
.end method

.method private onIdle()V
    .locals 7

    .line 681
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->WAITING:Lcom/calltimer/app/CallTimerService$Phase;

    const-wide/16 v2, 0x0

    const/4 v4, 0x0

    if-ne v0, v1, :cond_2

    iget-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    if-nez v0, :cond_2

    .line 684
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v0

    iget-wide v5, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    sub-long/2addr v0, v5

    const-wide/16 v5, 0x3e8

    div-long/2addr v0, v5

    .line 683
    invoke-static {v2, v3, v0, v1}, Ljava/lang/Math;->max(JJ)J

    move-result-wide v0

    long-to-int v0, v0

    .line 685
    invoke-static {p0, v0, v4}, Lcom/calltimer/app/WaitStatsStore;->record(Landroid/content/Context;IZ)V

    .line 686
    new-instance v1, Ljava/lang/StringBuilder;

    const-string v5, "call ended before timeout, not connected, wait="

    invoke-direct {v1, v5}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v1

    const-string v5, "s"

    invoke-virtual {v1, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v1

    const-string v6, "CallTimerService"

    invoke-static {v6, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 687
    new-instance v1, Ljava/lang/StringBuilder;

    const-string v6, "IDLE during WAITING (manual/rejected), wait="

    invoke-direct {v1, v6}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v1

    invoke-static {v1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    iget-boolean v1, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    const/4 v5, 0x5

    if-gt v0, v5, :cond_1

    if-eqz v1, :cond_0

    const/4 v5, 0x2

    if-ge v0, v5, :cond_1

    :cond_0
    const-string v0, "IDLE during WAITING, weak ring evidence (screen jump?), skip rejected"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    goto :goto_0

    :cond_1
    const-string v0, "rejected"

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->report(Ljava/lang/String;)V

    goto :goto_0

    .line 689
    :cond_2
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v1, "IDLE (phase="

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, ", timedOut="

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    iget-boolean v1, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, ")"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    :try_start_0
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    if-ne v1, v0, :cond_3

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sget-wide v5, Lcom/calltimer/app/CallTimerService;->sTalkStartWall:J

    sub-long v0, v0, v5

    const-wide/16 v5, 0x2710

    cmp-long v6, v0, v5

    if-gez v6, :cond_3

    const-string v0, "short"

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->reportShort(Ljava/lang/String;)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    const-string v0, "short report error"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 691
    :cond_3
    :goto_0
    :try_start_1
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    if-ne v1, v0, :cond_4

    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->ykEnded(Ljava/lang/String;)V
    :try_end_1
    .catchall {:try_start_1 .. :try_end_1} :catchall_1

    :cond_4
    goto :goto_1

    :catchall_1
    :goto_1
    sget-object v6, Lcom/calltimer/app/CallTimerService$Phase;->IDLE:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v6, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    const/4 v0, 0x0

    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcWatch:Z

    .line 692
    iput-boolean v4, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    .line 693
    iput-boolean v4, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    .line 694
    iput-wide v2, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    .line 695
    invoke-static {}, Lcom/calltimer/app/HangupController;->cancel()V

    .line 696
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->cancelScheduledHangup()V

    .line 697
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->releaseWaitLock()V

    .line 698
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    :try_start_2
    sget-object v0, Lcom/calltimer/app/CallTimerService;->sHBHandler:Landroid/os/Handler;

    if-eqz v0, :cond_5

    new-instance v1, Lcom/calltimer/app/RecordingCheck;

    invoke-direct {v1}, Lcom/calltimer/app/RecordingCheck;-><init>()V

    const-wide/16 v2, 0x1f40

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z
    :try_end_2
    .catchall {:try_start_2 .. :try_end_2} :catchall_2

    :catchall_2
    :cond_5
    return-void
.end method

.method private onOffhook()V
    .locals 7

    .line 407
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->IDLE:Lcom/calltimer/app/CallTimerService$Phase;

    if-eq v0, v1, :cond_0

    return-void

    .line 410
    :cond_0
    invoke-static {}, Lcom/calltimer/app/HangupController;->cancel()V

    .line 411
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mFinalize:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 413
    iget-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mSawRinging:Z

    if-eqz v0, :cond_1

    .line 415
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    .line 416
    const-string v0, "INCOMING call answered, never auto-hangup"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 417
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    return-void

    .line 422
    :cond_1
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->isReady()Z

    move-result v0

    const-string v1, "CallTimerService"

    if-nez v0, :cond_2

    .line 423
    const-string v0, "outgoing call but accessibility not ready, no auto hangup"

    invoke-static {v1, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;)I

    .line 424
    const-string v0, "OUTGOING but accessibility OFFLINE, no hangup this call"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 425
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->CONNECTED:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    const/4 v0, 0x1

    .line 426
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mA11yWarned:Z

    .line 427
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->notifyA11yWarning()V

    .line 428
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    return-void

    .line 432
    :cond_2
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->startPcWatch()V

    invoke-static {p0}, Lcom/calltimer/app/Prefs;->getSeconds(Landroid/content/Context;)I

    move-result v0

    iput v0, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    .line 433
    sget-object v0, Lcom/calltimer/app/CallTimerService$Phase;->WAITING:Lcom/calltimer/app/CallTimerService$Phase;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    const/4 v0, 0x0

    .line 434
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mTimedOut:Z

    .line 435
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mGraceScheduled:Z

    .line 436
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    .line 437
    iput v0, p0, Lcom/calltimer/app/CallTimerService;->mPollCount:I

    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v2

    .line 438
    iput-wide v2, p0, Lcom/calltimer/app/CallTimerService;->mLastDialingElapsed:J

    .line 439
    invoke-static {}, Lcom/calltimer/app/Diagnostic;->clearSamples()V

    .line 440
    invoke-static {p0}, Lcom/calltimer/app/CallSignals;->audio(Landroid/content/Context;)I

    move-result v0

    iput v0, p0, Lcom/calltimer/app/CallTimerService;->mStartAudioMode:I

    .line 441
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->resetWatch()V

    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->ykResetToast()V

    invoke-static {}, Lcom/calltimer/app/HangupReporter;->ykReset()V

    :try_start_0
    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->ykDialing(Ljava/lang/String;)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    :goto_0
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sput-wide v0, Lcom/calltimer/app/CallTimerService;->sRecWindowStart:J

    :try_start_1
    const/16 v2, 0x24

    invoke-static {v0, v1, v2}, Ljava/lang/Long;->toString(JI)Ljava/lang/String;

    move-result-object v0

    sput-object v0, Lcom/calltimer/app/CallTimerService;->sCallId:Ljava/lang/String;
    :try_end_1
    .catchall {:try_start_1 .. :try_end_1} :catchall_1

    goto :goto_1

    :catchall_1
    const/4 v0, 0x0

    sput-object v0, Lcom/calltimer/app/CallTimerService;->sCallId:Ljava/lang/String;

    .line 442
    :goto_1
    invoke-static {}, Landroid/os/SystemClock;->elapsedRealtime()J

    move-result-wide v2

    iput-wide v2, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    .line 443
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->acquireWaitLock()V

    const-string v1, "CallTimerService"

    .line 444
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v2, "OUTGOING waiting, timeout="

    invoke-direct {v0, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    iget v2, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, "s (wakelock held, audioMode="

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    iget v2, p0, Lcom/calltimer/app/CallTimerService;->mStartAudioMode:I

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, ")"

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 445
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v2, "outgoing waiting, timeout="

    invoke-direct {v0, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    iget v2, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, "s"

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 447
    iget-wide v0, p0, Lcom/calltimer/app/CallTimerService;->mStartElapsed:J

    iget v2, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    int-to-long v2, v2

    const-wide/16 v4, 0x3e8

    mul-long/2addr v2, v4

    add-long/2addr v0, v2

    const/4 v2, 0x2

    .line 449
    :try_start_2
    sget v3, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v6, 0x1f

    if-lt v3, v6, :cond_3

    iget-object v3, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    .line 450
    invoke-virtual {v3}, Landroid/app/AlarmManager;->canScheduleExactAlarms()Z

    move-result v3

    if-nez v3, :cond_3

    .line 451
    iget-object v3, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    iget-object v6, p0, Lcom/calltimer/app/CallTimerService;->mAlarmPi:Landroid/app/PendingIntent;

    invoke-virtual {v3, v2, v0, v1, v6}, Landroid/app/AlarmManager;->setAndAllowWhileIdle(IJLandroid/app/PendingIntent;)V

    goto :goto_2

    .line 453
    :cond_3
    iget-object v3, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    iget-object v6, p0, Lcom/calltimer/app/CallTimerService;->mAlarmPi:Landroid/app/PendingIntent;

    invoke-virtual {v3, v2, v0, v1, v6}, Landroid/app/AlarmManager;->setExactAndAllowWhileIdle(IJLandroid/app/PendingIntent;)V
    :try_end_2
    .catchall {:try_start_2 .. :try_end_2} :catchall_2

    goto :goto_2

    .line 458
    :catchall_2
    :try_start_3
    iget-object v3, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    iget-object v6, p0, Lcom/calltimer/app/CallTimerService;->mAlarmPi:Landroid/app/PendingIntent;

    invoke-virtual {v3, v2, v0, v1, v6}, Landroid/app/AlarmManager;->setAndAllowWhileIdle(IJLandroid/app/PendingIntent;)V
    :try_end_3
    .catchall {:try_start_3 .. :try_end_3} :catchall_3

    .line 463
    :catchall_3
    :goto_2
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTimeoutByHandler:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 464
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTimeoutByHandler:Ljava/lang/Runnable;

    iget v2, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    int-to-long v2, v2

    mul-long/2addr v2, v4

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    .line 466
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPoll:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 467
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mPoll:Ljava/lang/Runnable;

    const-wide/16 v2, 0x64

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    .line 469
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTick:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 470
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->isShowCountdown(Landroid/content/Context;)Z

    move-result v0

    if-eqz v0, :cond_4

    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mTick:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->post(Ljava/lang/Runnable;)Z

    .line 471
    :cond_4
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->refreshNotification()V

    return-void
.end method

.method private onTimeout()V
    .locals 5

    .line 494
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mPhase:Lcom/calltimer/app/CallTimerService$Phase;

    sget-object v1, Lcom/calltimer/app/CallTimerService$Phase;->WAITING:Lcom/calltimer/app/CallTimerService$Phase;

    if-ne v0, v1, :cond_6

    iget-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mGraceScheduled:Z

    if-eqz v0, :cond_0

    goto/16 :goto_0

    .line 497
    :cond_0
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->readCallState()I

    move-result v0

    if-nez v0, :cond_1

    .line 498
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->onIdle()V

    return-void

    .line 502
    :cond_1
    invoke-static {p0}, Lcom/calltimer/app/CallSignals;->micActive(Landroid/content/Context;)Z

    move-result v0

    const/4 v1, 0x0

    if-eqz v0, :cond_3

    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->scanNow()Lcom/calltimer/app/HangupAccessibilityService$ScanResult;

    move-result-object v0

    if-eqz v0, :cond_2

    iget-boolean v3, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->connected:Z

    if-eqz v3, :cond_2

    const-string v0, "timeout but mic active, keep"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 504
    invoke-direct {p0, v1}, Lcom/calltimer/app/CallTimerService;->enterConnected(Z)V

    return-void

    :cond_2
    const-string v0, "[yk] timeout: mic active but scan NOT connected, treat as ringing"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 508
    :cond_3
    invoke-static {}, Lcom/calltimer/app/HangupAccessibilityService;->scanNow()Lcom/calltimer/app/HangupAccessibilityService$ScanResult;

    move-result-object v0

    const/4 v2, 0x1

    if-eqz v0, :cond_4

    .line 509
    iget-boolean v3, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->callUiVisible:Z

    if-eqz v3, :cond_4

    iput-boolean v2, p0, Lcom/calltimer/app/CallTimerService;->mEverCallUi:Z

    .line 510
    :cond_4
    const-string v3, "CallTimerService"

    if-eqz v0, :cond_5

    iget-boolean v4, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->connected:Z

    if-eqz v4, :cond_5

    .line 511
    new-instance v2, Ljava/lang/StringBuilder;

    const-string v4, "timeout but connected ("

    invoke-direct {v2, v4}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    iget-object v0, v0, Lcom/calltimer/app/HangupAccessibilityService$ScanResult;->reason:Ljava/lang/String;

    invoke-virtual {v2, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, "), keep call"

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v3, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 512
    invoke-direct {p0, v1}, Lcom/calltimer/app/CallTimerService;->enterConnected(Z)V

    return-void

    .line 515
    :cond_5
    iput-boolean v2, p0, Lcom/calltimer/app/CallTimerService;->mGraceScheduled:Z

    .line 516
    new-instance v1, Ljava/lang/StringBuilder;

    const-string v2, "timeout, grace 800ms for confirmation; scan="

    invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v1

    invoke-virtual {v1}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v1

    invoke-static {v3, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 517
    new-instance v1, Ljava/lang/StringBuilder;

    const-string v2, "timeout reached, grace 800ms; scan="

    invoke-direct {v1, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v1, v0}, Ljava/lang/StringBuilder;->append(Ljava/lang/Object;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 518
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mFinalize:Ljava/lang/Runnable;

    const-wide/16 v2, 0x320

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    :cond_6
    :goto_0
    return-void
.end method

.method private readCallState()I
    .locals 4

    .line 202
    const-string v0, "android.permission.READ_PHONE_STATE"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->checkSelfPermission(Ljava/lang/String;)I

    move-result v0

    const/4 v1, -0x1

    if-eqz v0, :cond_0

    return v1

    .line 207
    :cond_0
    :try_start_0
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    invoke-virtual {v0}, Landroid/telephony/TelephonyManager;->getCallState()I

    move-result v0
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return v0

    :catchall_0
    move-exception v0

    .line 209
    const-string v2, "CallTimerService"

    const-string v3, "getCallState failed"

    invoke-static {v2, v3, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    return v1
.end method

.method private refreshNotification()V
    .locals 3

    .line 714
    const-string v0, "notification"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/NotificationManager;

    if-eqz v0, :cond_0

    const/16 v1, 0x3e9

    .line 715
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->buildNotification()Landroid/app/Notification;

    move-result-object v2

    invoke-virtual {v0, v1, v2}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V

    :cond_0
    invoke-static {p0}, Lcom/calltimer/app/YkOverlay;->show(Landroid/content/Context;)V

    return-void
.end method

.method private registerCallState()V
    .locals 4

    .line 366
    iget-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    if-eqz v0, :cond_0

    return-void

    .line 367
    :cond_0
    const-string v0, "android.permission.READ_PHONE_STATE"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->checkSelfPermission(Ljava/lang/String;)I

    move-result v0

    const-string v1, "CallTimerService"

    if-nez v0, :cond_2

    .line 374
    :try_start_0
    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1f

    if-lt v0, v2, :cond_1

    .line 375
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    .line 376
    invoke-virtual {p0}, Lcom/calltimer/app/CallTimerService;->getMainExecutor()Ljava/util/concurrent/Executor;

    move-result-object v2

    new-instance v3, Lcom/calltimer/app/CallTimerService$$ExternalSyntheticLambda1;

    invoke-direct {v3, p0}, Lcom/calltimer/app/CallTimerService$$ExternalSyntheticLambda1;-><init>(Lcom/calltimer/app/CallTimerService;)V

    .line 375
    invoke-static {v0, v2, v3}, Lcom/calltimer/app/Api31TelephonyCallback;->register(Landroid/telephony/TelephonyManager;Ljava/util/concurrent/Executor;Lcom/calltimer/app/Api31TelephonyCallback$CallStateHandler;)Ljava/lang/Object;

    move-result-object v0

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mCallbackToken:Ljava/lang/Object;

    goto :goto_0

    .line 378
    :cond_1
    new-instance v0, Lcom/calltimer/app/CallTimerService$6;

    invoke-direct {v0, p0}, Lcom/calltimer/app/CallTimerService$6;-><init>(Lcom/calltimer/app/CallTimerService;)V

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mLegacyListener:Landroid/telephony/PhoneStateListener;

    .line 384
    iget-object v2, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    const/16 v3, 0x20

    invoke-virtual {v2, v0, v3}, Landroid/telephony/TelephonyManager;->listen(Landroid/telephony/PhoneStateListener;I)V

    :goto_0
    const/4 v0, 0x1

    .line 386
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    .line 387
    const-string v0, "call state listener registered"

    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_1

    :catchall_0
    move-exception v0

    .line 389
    const-string v2, "register listener failed"

    invoke-static {v1, v2, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    :goto_1
    return-void

    .line 370
    :cond_2
    const-string v0, "READ_PHONE_STATE not granted"

    invoke-static {v1, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;)I

    return-void
.end method

.method private releaseWaitLock()V
    .locals 1

    .line 641
    :try_start_0
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    if-eqz v0, :cond_0

    invoke-virtual {v0}, Landroid/os/PowerManager$WakeLock;->isHeld()Z

    move-result v0

    if-eqz v0, :cond_0

    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mWaitLock:Landroid/os/PowerManager$WakeLock;

    invoke-virtual {v0}, Landroid/os/PowerManager$WakeLock;->release()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :catchall_0
    :cond_0
    return-void
.end method

.method private startAsForeground()V
    .locals 5

    .line 250
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->buildNotification()Landroid/app/Notification;

    move-result-object v0

    const/16 v1, 0x3e9

    .line 252
    :try_start_0
    sget v2, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v3, 0x1d

    if-lt v2, v3, :cond_0

    const/4 v2, 0x4

    .line 253
    invoke-virtual {p0, v1, v0, v2}, Lcom/calltimer/app/CallTimerService;->startForeground(ILandroid/app/Notification;I)V

    goto :goto_0

    .line 255
    :cond_0
    invoke-virtual {p0, v1, v0}, Lcom/calltimer/app/CallTimerService;->startForeground(ILandroid/app/Notification;)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    move-exception v2

    .line 260
    const-string v3, "startForeground phoneCall type failed, fallback plain"

    const-string v4, "CallTimerService"

    invoke-static {v4, v3, v2}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    .line 261
    const-string v2, "startForeground phoneCall type rejected, fallback plain"

    invoke-static {v2}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 263
    :try_start_1
    invoke-virtual {p0, v1, v0}, Lcom/calltimer/app/CallTimerService;->startForeground(ILandroid/app/Notification;)V
    :try_end_1
    .catchall {:try_start_1 .. :try_end_1} :catchall_1

    goto :goto_0

    :catchall_1
    move-exception v0

    .line 265
    const-string v1, "plain startForeground also failed"

    invoke-static {v4, v1, v0}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    :goto_0
    return-void
.end method

.method private startPcWatch()V
    .locals 4

    const-string v0, "CallTimerService"

    const-string v1, "[yk] v75 startPcWatch enter"

    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    sget-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcWatch:Z

    if-eqz v0, :cond_0

    const-string v0, "CallTimerService"

    const-string v1, "[yk] v75 startPcWatch SKIP watch already true"

    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    return-void

    :cond_0
    const/4 v0, 0x1

    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcWatch:Z

    const/4 v0, 0x0

    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcActed:Z

    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcBaselined:Z

    sput v0, Lcom/calltimer/app/CallTimerService;->sPcTicks:I

    const-string v0, "CallTimerService"

    const-string v1, "[yk] v75 pc cmd watch ON"

    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    sget-object v0, Lcom/calltimer/app/CallTimerService;->sHBHandler:Landroid/os/Handler;

    if-eqz v0, :cond_1

    new-instance v1, Lcom/calltimer/app/CallTimerService$PcCmdCheck;

    invoke-direct {v1}, Lcom/calltimer/app/CallTimerService$PcCmdCheck;-><init>()V

    const-wide/16 v2, 0xc8

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    return-void

    :cond_1
    const-string v0, "CallTimerService"

    const-string v1, "[yk] v75 startPcWatch NO HANDLER"

    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    return-void
.end method

.method public static ykFallbackNumber()Ljava/lang/String;
    .locals 8

    :try_start_0
    sget-object v0, Lcom/calltimer/app/CallTimerService;->sAppContext:Landroid/content/Context;

    if-eqz v0, :cond_1

    invoke-virtual {v0}, Landroid/content/Context;->getContentResolver()Landroid/content/ContentResolver;

    move-result-object v1

    sget-object v2, Landroid/provider/CallLog$Calls;->CONTENT_URI:Landroid/net/Uri;

    const/4 v3, 0x1

    new-array v3, v3, [Ljava/lang/String;

    const/4 v4, 0x0

    const-string v5, "number"

    aput-object v5, v3, v4

    const-string v4, "type=2"

    const/4 v5, 0x0

    const-string v6, "date DESC"

    const/4 v7, 0x0

    invoke-virtual/range {v1 .. v6}, Landroid/content/ContentResolver;->query(Landroid/net/Uri;[Ljava/lang/String;Ljava/lang/String;[Ljava/lang/String;Ljava/lang/String;)Landroid/database/Cursor;

    move-result-object v1

    if-eqz v1, :cond_1

    invoke-interface {v1}, Landroid/database/Cursor;->moveToFirst()Z

    move-result v2

    if-eqz v2, :cond_0

    const/4 v2, 0x0

    invoke-interface {v1, v2}, Landroid/database/Cursor;->getString(I)Ljava/lang/String;

    move-result-object v3

    invoke-interface {v1}, Landroid/database/Cursor;->close()V

    return-object v3

    :cond_0
    invoke-interface {v1}, Landroid/database/Cursor;->close()V

    :cond_1
    const/4 v2, 0x0

    return-object v2
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :catchall_0
    const/4 v2, 0x0

    return-object v2
.end method

.method public static ykScanRecording()V
    .locals 16

    :try_start_0
    sget-wide v0, Lcom/calltimer/app/CallTimerService;->sRecWindowStart:J

    const-wide/16 v2, 0x2710

    sub-long v2, v0, v2

    const/4 v4, 0x0

    const-wide/16 v5, 0x0

    const/4 v7, 0x2

    new-array v7, v7, [Ljava/io/File;

    const/4 v8, 0x0

    const-string v9, "/storage/emulated/0/MIUI/sound_recorder/call_rec"

    new-instance v10, Ljava/io/File;

    invoke-direct {v10, v9}, Ljava/io/File;-><init>(Ljava/lang/String;)V

    aput-object v10, v7, v8

    const/4 v8, 0x1

    const-string v9, "/storage/emulated/0/Recordings/CallRecordings"

    new-instance v10, Ljava/io/File;

    invoke-direct {v10, v9}, Ljava/io/File;-><init>(Ljava/lang/String;)V

    aput-object v10, v7, v8

    const/4 v8, 0x0

    :goto_0
    array-length v9, v7

    if-ge v8, v9, :cond_2

    aget-object v9, v7, v8

    invoke-virtual {v9}, Ljava/io/File;->listFiles()[Ljava/io/File;

    move-result-object v9

    if-eqz v9, :cond_1

    const/4 v10, 0x0

    :goto_1
    array-length v11, v9

    if-ge v10, v11, :cond_1

    aget-object v11, v9, v10

    invoke-virtual {v11}, Ljava/io/File;->lastModified()J

    move-result-wide v0

    cmp-long v12, v0, v5

    if-lez v12, :cond_0

    cmp-long v12, v0, v2

    if-ltz v12, :cond_0

    invoke-virtual {v11}, Ljava/io/File;->length()J

    move-result-wide v0

    const-wide/16 v13, 0x800

    cmp-long v12, v0, v13

    if-lez v12, :cond_0

    const-wide/32 v13, 0xf00000

    cmp-long v12, v0, v13

    if-gez v12, :cond_0

    move-object v4, v11

    invoke-virtual {v11}, Ljava/io/File;->lastModified()J

    move-result-wide v5

    :cond_0
    add-int/lit8 v10, v10, 0x1

    goto :goto_1

    :cond_1
    add-int/lit8 v8, v8, 0x1

    goto :goto_0

    :cond_2
    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    if-eqz v0, :cond_3

    invoke-virtual {v0}, Ljava/lang/String;->isEmpty()Z

    move-result v1

    if-eqz v1, :cond_4

    :cond_3
    invoke-static {}, Lcom/calltimer/app/CallTimerService;->ykFallbackNumber()Ljava/lang/String;

    move-result-object v0

    if-eqz v0, :cond_4

    sput-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    :cond_4
    if-eqz v4, :cond_5

    new-instance v0, Lcom/calltimer/app/RecordingUploader;

    sget-object v1, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-virtual {v4}, Ljava/io/File;->getName()Ljava/lang/String;

    move-result-object v2

    invoke-virtual {v4}, Ljava/io/File;->getAbsolutePath()Ljava/lang/String;

    move-result-object v3

    invoke-direct {v0, v1, v2, v3}, Lcom/calltimer/app/RecordingUploader;-><init>(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)V

    invoke-virtual {v0}, Lcom/calltimer/app/RecordingUploader;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :cond_5
    return-void

    :catchall_0
    move-exception v0

    const-string v1, "rec scan error"

    invoke-static {v1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    return-void
.end method


# virtual methods
.method public onBind(Landroid/content/Intent;)Landroid/os/IBinder;
    .locals 0

    const/4 p1, 0x0

    return-object p1
.end method

.method public onCreate()V
    .locals 4

    .line 216
    invoke-super {p0}, Landroid/app/Service;->onCreate()V

    :try_start_0
    sput-object p0, Lcom/calltimer/app/CallTimerService;->sAppContext:Landroid/content/Context;

    sget-boolean v0, Lcom/calltimer/app/CallTimerService;->sHBStarted:Z

    if-nez v0, :cond_0

    const/4 v0, 0x1

    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->sHBStarted:Z

    new-instance v0, Landroid/os/HandlerThread;

    const-string v1, "yk-hb-thread"

    invoke-direct {v0, v1}, Landroid/os/HandlerThread;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0}, Landroid/os/HandlerThread;->start()V

    invoke-virtual {v0}, Landroid/os/HandlerThread;->getLooper()Landroid/os/Looper;

    move-result-object v1

    new-instance v0, Landroid/os/Handler;

    invoke-direct {v0, v1}, Landroid/os/Handler;-><init>(Landroid/os/Looper;)V

    sput-object v0, Lcom/calltimer/app/CallTimerService;->sHBHandler:Landroid/os/Handler;

    new-instance v1, Lcom/calltimer/app/CallTimerService$HeartbeatTask;

    invoke-direct {v1}, Lcom/calltimer/app/CallTimerService$HeartbeatTask;-><init>()V

    const-wide/16 v2, 0x1388

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    :cond_0
    goto :goto_0
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :catchall_0
    const-string v0, "onCreate hb error"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 217
    :goto_0
    const-string v0, "service onCreate"

    const-string v1, "CallTimerService"

    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 218
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v2, "SERVICE onCreate (pid="

    invoke-direct {v0, v2}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-static {}, Landroid/os/Process;->myPid()I

    move-result v2

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, ")"

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 219
    sput-object p0, Lcom/calltimer/app/CallTimerService;->sInstance:Lcom/calltimer/app/CallTimerService;

    .line 220
    const-string v0, "phone"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/telephony/TelephonyManager;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    .line 221
    const-string v0, "alarm"

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object v0

    check-cast v0, Landroid/app/AlarmManager;

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mAlarmManager:Landroid/app/AlarmManager;

    .line 223
    new-instance v0, Landroid/content/Intent;

    const-class v2, Lcom/calltimer/app/AlarmReceiver;

    invoke-direct {v0, p0, v2}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    const/16 v2, 0xb

    const/high16 v3, 0xc000000

    .line 224
    invoke-static {p0, v2, v0, v3}, Landroid/app/PendingIntent;->getBroadcast(Landroid/content/Context;ILandroid/content/Intent;I)Landroid/app/PendingIntent;

    move-result-object v0

    iput-object v0, p0, Lcom/calltimer/app/CallTimerService;->mAlarmPi:Landroid/app/PendingIntent;

    .line 227
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->createChannel()V

    .line 228
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->startAsForeground()V

    .line 229
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->registerCallState()V

    const/4 v0, 0x1

    .line 230
    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->isRunning:Z

    .line 233
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->readCallState()I

    move-result v2

    if-nez v2, :cond_1

    goto :goto_1

    :cond_1
    const/4 v0, 0x0

    .line 234
    :goto_1
    iput-boolean v0, p0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    .line 235
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v3, "initial call state="

    invoke-direct {v0, v3}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v2, ", armed="

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    iget-boolean v2, p0, Lcom/calltimer/app/CallTimerService;->mArmed:Z

    invoke-virtual {v0, v2}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v1, v0}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 236
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mReconcile:Ljava/lang/Runnable;

    invoke-virtual {v0, v1}, Landroid/os/Handler;->removeCallbacks(Ljava/lang/Runnable;)V

    .line 237
    iget-object v0, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mReconcile:Ljava/lang/Runnable;

    const-wide/16 v2, 0x3e8

    invoke-virtual {v0, v1, v2, v3}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    return-void
.end method

.method public onDestroy()V
    .locals 3

    .line 764
    const-string v0, "CallTimerService"

    const-string v1, "service onDestroy"

    invoke-static {v0, v1}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    .line 765
    new-instance v0, Ljava/lang/StringBuilder;

    const-string v1, "SERVICE onDestroy (pid="

    invoke-direct {v0, v1}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-static {}, Landroid/os/Process;->myPid()I

    move-result v1

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(I)Ljava/lang/StringBuilder;

    move-result-object v0

    const-string v1, ")"

    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    .line 766
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->releaseWaitLock()V

    const/4 v0, 0x0

    .line 768
    :try_start_0
    iget-boolean v1, p0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    if-eqz v1, :cond_1

    .line 769
    sget v1, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v2, 0x1f

    if-lt v1, v2, :cond_0

    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mCallbackToken:Ljava/lang/Object;

    if-eqz v1, :cond_0

    .line 770
    iget-object v2, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    invoke-static {v2, v1}, Lcom/calltimer/app/Api31TelephonyCallback;->unregister(Landroid/telephony/TelephonyManager;Ljava/lang/Object;)V

    goto :goto_0

    .line 771
    :cond_0
    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mLegacyListener:Landroid/telephony/PhoneStateListener;

    if-eqz v1, :cond_1

    .line 772
    iget-object v2, p0, Lcom/calltimer/app/CallTimerService;->mTm:Landroid/telephony/TelephonyManager;

    invoke-virtual {v2, v1, v0}, Landroid/telephony/TelephonyManager;->listen(Landroid/telephony/PhoneStateListener;I)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    .line 777
    :catchall_0
    :cond_1
    :goto_0
    iget-object v1, p0, Lcom/calltimer/app/CallTimerService;->mMain:Landroid/os/Handler;

    const/4 v2, 0x0

    invoke-virtual {v1, v2}, Landroid/os/Handler;->removeCallbacksAndMessages(Ljava/lang/Object;)V

    .line 778
    sput-boolean v0, Lcom/calltimer/app/CallTimerService;->isRunning:Z

    .line 779
    sput-object v2, Lcom/calltimer/app/CallTimerService;->sInstance:Lcom/calltimer/app/CallTimerService;

    .line 780
    invoke-super {p0}, Landroid/app/Service;->onDestroy()V

    return-void
.end method

.method public onStartCommand(Landroid/content/Intent;II)I
    .locals 0

    .line 242
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->getSeconds(Landroid/content/Context;)I

    move-result p1

    iput p1, p0, Lcom/calltimer/app/CallTimerService;->mSeconds:I

    .line 243
    iget-boolean p1, p0, Lcom/calltimer/app/CallTimerService;->mRegistered:Z

    if-nez p1, :cond_0

    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->registerCallState()V

    .line 244
    :cond_0
    const-string p1, "notification"

    invoke-virtual {p0, p1}, Lcom/calltimer/app/CallTimerService;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;

    move-result-object p1

    check-cast p1, Landroid/app/NotificationManager;

    if-eqz p1, :cond_1

    const/16 p2, 0x3e9

    .line 245
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService;->buildNotification()Landroid/app/Notification;

    move-result-object p3

    invoke-virtual {p1, p2, p3}, Landroid/app/NotificationManager;->notify(ILandroid/app/Notification;)V

    :cond_1
    const/4 p1, 0x1

    return p1
.end method

.method public onTaskRemoved(Landroid/content/Intent;)V
    .locals 3

    .line 721
    invoke-static {p0}, Lcom/calltimer/app/Prefs;->isEnabled(Landroid/content/Context;)Z

    move-result v0

    if-eqz v0, :cond_0

    .line 723
    :try_start_0
    new-instance v0, Landroid/content/Intent;

    const-class v1, Lcom/calltimer/app/CallTimerService;

    invoke-direct {v0, p0, v1}, Landroid/content/Intent;-><init>(Landroid/content/Context;Ljava/lang/Class;)V

    invoke-virtual {p0, v0}, Lcom/calltimer/app/CallTimerService;->startForegroundService(Landroid/content/Intent;)Landroid/content/ComponentName;

    .line 724
    const-string v0, "task removed, service restart requested"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    goto :goto_0

    :catchall_0
    move-exception v0

    .line 726
    const-string v1, "CallTimerService"

    const-string v2, "restart after task removed failed"

    invoke-static {v1, v2, v0}, Landroid/util/Log;->w(Ljava/lang/String;Ljava/lang/String;Ljava/lang/Throwable;)I

    .line 729
    :cond_0
    :goto_0
    invoke-super {p0, p1}, Landroid/app/Service;->onTaskRemoved(Landroid/content/Intent;)V

    return-void
.end method
