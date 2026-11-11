.class public Lcom/calltimer/app/HangupReporter;
.super Ljava/lang/Thread;
.source "HangupReporter.java"


# static fields
.field private static lastReport:J

.field private static sEverConnected:Z

.field private static sLastIncoming:J

.field private static sPendingNumber:Ljava/lang/String;

.field private static sReason:Ljava/lang/String;


# instance fields
.field private mCallId:Ljava/lang/String;

.field private mEvType:Ljava/lang/String;

.field private mNum:Ljava/lang/String;

.field private mReason:Ljava/lang/String;


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Thread;-><init>()V

    return-void
.end method

.method public static report()V
    .locals 1

    sget-object v0, Lcom/calltimer/app/HangupAccessibilityService;->sCallNumber:Ljava/lang/String;

    invoke-static {v0}, Lcom/calltimer/app/HangupReporter;->report(Ljava/lang/String;)V

    return-void
.end method

.method public static report(Ljava/lang/String;)V
    .locals 6

    sget-boolean v0, Lcom/calltimer/app/HangupReporter;->sEverConnected:Z

    if-eqz v0, :cond_0

    return-void

    :cond_0
    sput-object p0, Lcom/calltimer/app/HangupReporter;->sPendingNumber:Ljava/lang/String;

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sget-wide v2, Lcom/calltimer/app/HangupReporter;->lastReport:J

    sub-long v4, v0, v2

    const-wide/16 v0, 0x4e20

    cmp-long v2, v4, v0

    if-gez v2, :cond_1

    return-void

    :cond_1
    :try_start_0
    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sput-wide v0, Lcom/calltimer/app/HangupReporter;->lastReport:J

    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "hangup"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    sget-object v1, Lcom/calltimer/app/HangupReporter;->sReason:Ljava/lang/String;

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mReason:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    sget-object v1, Lcom/calltimer/app/CallTimerService;->sCallId:Ljava/lang/String;

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mCallId:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return-void

    :catchall_0
    const-string v0, "report spawn error"

    invoke-static {v0}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    return-void
.end method

.method public static reportShort(Ljava/lang/String;)V
    .locals 2

    :try_start_0
    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "hangup"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    const-string v1, "short"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mReason:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    sget-object v1, Lcom/calltimer/app/CallTimerService;->sCallId:Ljava/lang/String;

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mCallId:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return-void

    :catchall_0
    move-exception v0

    const-string v1, "reportShort spawn error"

    invoke-static {v1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    return-void
.end method

.method public static ykAnswered(Ljava/lang/String;)V
    .locals 2

    :try_start_0
    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "answered"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return-void

    :catchall_0
    return-void
.end method

.method public static ykDialing(Ljava/lang/String;)V
    .locals 2

    :try_start_0
    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "dialing"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return-void

    :catchall_0
    return-void
.end method

.method public static ykEnded(Ljava/lang/String;)V
    .locals 2

    :try_start_0
    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "ended"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V
    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    return-void

    :catchall_0
    return-void
.end method

.method public static ykGetReason()Ljava/lang/String;
    .locals 1

    sget-object v0, Lcom/calltimer/app/HangupReporter;->sReason:Ljava/lang/String;

    return-object v0
.end method

.method public static ykHeartbeat(Z)V
    .locals 2

    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "heartbeat"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    if-eqz p0, :cond_0

    const-string v1, "1"

    goto :goto_0

    :cond_0
    const-string v1, "0"

    :goto_0
    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V

    return-void
.end method

.method public static ykIncomingReport(Ljava/lang/String;)V
    .locals 6

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sget-wide v2, Lcom/calltimer/app/HangupReporter;->sLastIncoming:J

    sub-long v0, v0, v2

    const-wide/16 v2, 0x2710

    cmp-long v4, v0, v2

    if-lez v4, :cond_0

    invoke-static {}, Ljava/lang/System;->currentTimeMillis()J

    move-result-wide v0

    sput-wide v0, Lcom/calltimer/app/HangupReporter;->sLastIncoming:J

    new-instance v0, Lcom/calltimer/app/HangupReporter;

    invoke-direct {v0}, Lcom/calltimer/app/HangupReporter;-><init>()V

    const-string v1, "incoming"

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    iput-object p0, v0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    const/4 v1, 0x0

    iput-object v1, v0, Lcom/calltimer/app/HangupReporter;->mReason:Ljava/lang/String;

    invoke-virtual {v0}, Lcom/calltimer/app/HangupReporter;->start()V

    :cond_0
    return-void
.end method

.method public static ykMarkConnected()V
    .locals 1

    const/4 v0, 0x1

    sput-boolean v0, Lcom/calltimer/app/HangupReporter;->sEverConnected:Z

    return-void
.end method

.method public static ykReset()V
    .locals 2

    const-wide/16 v0, 0x0

    sput-wide v0, Lcom/calltimer/app/HangupReporter;->lastReport:J

    const/4 v0, 0x0

    sput-boolean v0, Lcom/calltimer/app/HangupReporter;->sEverConnected:Z

    const/4 v0, 0x0

    sput-object v0, Lcom/calltimer/app/HangupReporter;->sReason:Ljava/lang/String;

    return-void
.end method

.method public static ykSetReason(Ljava/lang/String;)V
    .locals 0

    sput-object p0, Lcom/calltimer/app/HangupReporter;->sReason:Ljava/lang/String;

    return-void
.end method


# virtual methods
.method public run()V
    .locals 8

    :try_start_0
    new-instance v0, Ljava/net/URL;

    const-string v1, "http://192.168.1.147:8787/rest/call_events"

    invoke-direct {v0, v1}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;

    move-result-object v0

    check-cast v0, Ljava/net/HttpURLConnection;

    const-string v1, "POST"

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setRequestMethod(Ljava/lang/String;)V

    const-string v1, "x-wb-webapp-access-key"

    const-string v2, "YOUR_RELAY_ACCESS_KEY"

    invoke-virtual {v0, v1, v2}, Ljava/net/HttpURLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V

    const-string v1, "Content-Type"

    const-string v2, "application/json"

    invoke-virtual {v0, v1, v2}, Ljava/net/HttpURLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V

    const/4 v1, 0x1

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setDoOutput(Z)V

    const/16 v1, 0x1388

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getOutputStream()Ljava/io/OutputStream;

    move-result-object v1

    new-instance v5, Ljava/lang/StringBuilder;

    invoke-direct {v5}, Ljava/lang/StringBuilder;-><init>()V

    const-string v6, "{\"event_type\":\""

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    if-eqz v6, :cond_0

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    goto :goto_0

    :cond_0
    const-string v6, "hangup"

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    :goto_0
    const-string v6, "\",\"source\":\"apk"

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mEvType:Ljava/lang/String;

    if-eqz v6, :cond_1

    const-string v7, "heartbeat"

    invoke-virtual {v6, v7}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v6

    if-eqz v6, :cond_1

    const-string v7, ":hb:"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    if-eqz v6, :cond_4

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    goto :goto_1

    :cond_1
    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mNum:Ljava/lang/String;

    if-eqz v6, :cond_2

    invoke-virtual {v6}, Ljava/lang/String;->length()I

    move-result v7

    if-lez v7, :cond_2

    const-string v7, ":"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    :cond_2
    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mReason:Ljava/lang/String;

    if-eqz v6, :cond_3

    invoke-virtual {v6}, Ljava/lang/String;->length()I

    move-result v7

    if-lez v7, :cond_3

    const-string v7, ":"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    :cond_3
    iget-object v6, p0, Lcom/calltimer/app/HangupReporter;->mCallId:Ljava/lang/String;

    if-eqz v6, :cond_4

    const-string v7, ":"

    invoke-virtual {v5, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    :cond_4
    :goto_1
    const-string v6, "\"}"

    invoke-virtual {v5, v6}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v5

    invoke-virtual {v5}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v2

    invoke-virtual {v2}, Ljava/lang/String;->getBytes()[B

    move-result-object v2

    const/4 v3, 0x0

    array-length v4, v2

    invoke-virtual {v1, v2, v3, v4}, Ljava/io/OutputStream;->write([BII)V

    invoke-virtual {v1}, Ljava/io/OutputStream;->close()V

    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getResponseCode()I

    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->disconnect()V
    :try_end_0
    .catch Ljava/lang/Throwable; {:try_start_0 .. :try_end_0} :catch_0

    goto :goto_2

    :catch_0
    move-exception v0

    :goto_2
    return-void
.end method
