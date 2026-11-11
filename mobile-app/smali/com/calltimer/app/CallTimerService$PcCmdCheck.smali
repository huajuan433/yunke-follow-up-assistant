.class public final Lcom/calltimer/app/CallTimerService$PcCmdCheck;
.super Ljava/lang/Object;
.source "CallTimerService.java"

# interfaces
.implements Ljava/lang/Runnable;


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    return-void
.end method

.method private fetchCmd()J
    .locals 9

    new-instance v0, Ljava/net/URL;

    const-string v1, "http://192.168.1.147:8787/rest/call_events?select=id,event_type&event_type=eq.pc_hangup&order=id.desc&limit=1"

    invoke-direct {v0, v1}, Ljava/net/URL;-><init>(Ljava/lang/String;)V

    invoke-virtual {v0}, Ljava/net/URL;->openConnection()Ljava/net/URLConnection;

    move-result-object v0

    check-cast v0, Ljava/net/HttpURLConnection;

    const-string v1, "x-wb-webapp-access-key"

    const-string v2, "YOUR_RELAY_ACCESS_KEY"

    invoke-virtual {v0, v1, v2}, Ljava/net/HttpURLConnection;->setRequestProperty(Ljava/lang/String;Ljava/lang/String;)V

    const/16 v1, 0xbb8

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setConnectTimeout(I)V

    const/16 v1, 0xbb8

    invoke-virtual {v0, v1}, Ljava/net/HttpURLConnection;->setReadTimeout(I)V

    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->getInputStream()Ljava/io/InputStream;

    move-result-object v1

    new-instance v2, Ljava/io/BufferedReader;

    new-instance v3, Ljava/io/InputStreamReader;

    invoke-direct {v3, v1}, Ljava/io/InputStreamReader;-><init>(Ljava/io/InputStream;)V

    invoke-direct {v2, v3}, Ljava/io/BufferedReader;-><init>(Ljava/io/Reader;)V

    new-instance v4, Ljava/lang/StringBuilder;

    invoke-direct {v4}, Ljava/lang/StringBuilder;-><init>()V

    :goto_0
    invoke-virtual {v2}, Ljava/io/BufferedReader;->readLine()Ljava/lang/String;

    move-result-object v5

    if-eqz v5, :cond_0

    invoke-virtual {v4, v5}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;

    move-result-object v4

    goto :goto_0

    :cond_0
    invoke-virtual {v2}, Ljava/io/BufferedReader;->close()V

    invoke-virtual {v0}, Ljava/net/HttpURLConnection;->disconnect()V

    invoke-virtual {v4}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v0

    invoke-virtual {v0}, Ljava/lang/String;->length()I

    move-result v1

    if-lez v1, :cond_1

    new-instance v2, Lorg/json/JSONArray;

    invoke-direct {v2, v0}, Lorg/json/JSONArray;-><init>(Ljava/lang/String;)V

    const/4 v3, 0x0

    invoke-virtual {v2, v3}, Lorg/json/JSONArray;->optJSONObject(I)Lorg/json/JSONObject;

    move-result-object v2

    if-eqz v2, :cond_1

    const-string v3, "id"

    invoke-virtual {v2, v3}, Lorg/json/JSONObject;->optLong(Ljava/lang/String;)J

    move-result-wide v4

    return-wide v4

    :cond_1
    const-wide/16 v4, 0x0

    return-wide v4
.end method


# virtual methods
.method public run()V
    .locals 6

    sget v0, Lcom/calltimer/app/CallTimerService;->sPcTicks:I

    add-int/lit8 v0, v0, 0x1

    sput v0, Lcom/calltimer/app/CallTimerService;->sPcTicks:I

    # Keep a low-rate liveness breadcrumb; the command poll itself remains at 200 ms.
    rem-int/lit16 v1, v0, 0x96

    if-nez v1, :cond_tick

    const-string v1, "CallTimerService"

    const-string v2, "[yk] v81 pc poll alive"

    invoke-static {v1, v2}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    :cond_tick
    sget-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcWatch:Z

    if-eqz v0, :cond_2

    :try_start_0
    sget-object v0, Lcom/calltimer/app/CallTimerService;->sAppContext:Landroid/content/Context;

    if-nez v0, :cond_ctx

    const-string v1, "CallTimerService"

    const-string v2, "[yk] v81 pc poll NULL CONTEXT"

    invoke-static {v1, v2}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    goto :cond_1

    :cond_ctx
    invoke-direct {p0}, Lcom/calltimer/app/CallTimerService$PcCmdCheck;->fetchCmd()J

    move-result-wide v1

    sget-boolean v3, Lcom/calltimer/app/CallTimerService;->sPcBaselined:Z

    if-nez v3, :cond_0

    # [v79] fetchCmd 失败/没有行时返回 0，老逻辑照样立基线（sPcLastId=0），
    # 于是下一次成功轮询拿到"几分钟前的旧指令"（id 远大于 0）就当新指令执行 → 刚拨通就被挂断。
    # 真机现象：服务崩溃重启后每通一接通就掉。现在只有取到有效 id 才算基线，取失败就下个 tick 再试。
    const-wide/16 v3, 0x0

    cmp-long v5, v1, v3

    if-lez v5, :cond_base_ok

    goto :goto_0

    :cond_base_ok
    sput-wide v1, Lcom/calltimer/app/CallTimerService;->sPcLastId:J

    const/4 v3, 0x1

    sput-boolean v3, Lcom/calltimer/app/CallTimerService;->sPcBaselined:Z

    const-string v3, "CallTimerService"

    const-string v4, "[yk] v81 pc poll BASELINED"

    invoke-static {v3, v4}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    goto :goto_0

    :cond_0
    sget-wide v3, Lcom/calltimer/app/CallTimerService;->sPcLastId:J

    cmp-long v5, v1, v3

    if-lez v5, :cond_1

    sput-wide v1, Lcom/calltimer/app/CallTimerService;->sPcLastId:J

    # [v76] 去掉"每通只执行一次"的一次性闩锁：电脑一次挂断会发两条指令（点按监听 + 流程补点），
    # 老逻辑第一条把机会吃掉，用户随后手动按的那条就被丢掉（实测成对指令，间隔 2~3 秒）。
    # 指令 id 本身单调递增，重复执行也只是再走一遍挂断流程（通话已结束会自己取消）。
    const/4 v3, 0x1

    sput-boolean v3, Lcom/calltimer/app/CallTimerService;->sPcActed:Z

    const-string v1, "CallTimerService"

    const-string v2, "[yk] v81 pc hangup cmd -> HangupController.run"

    invoke-static {v1, v2}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    const-string v3, "pc"

    invoke-static {v3}, Lcom/calltimer/app/HangupReporter;->ykSetReason(Ljava/lang/String;)V

    # A PC hangup is an explicit request: try Telecom first. Only use the accessibility
    # fallback if Telecom rejects it, so one command cannot trigger two hangup actions.
    invoke-static {v0}, Lcom/calltimer/app/EndCallApi29;->endCallTelecom(Landroid/content/Context;)Z

    move-result v1

    const-string v2, "CallTimerService"

    new-instance v3, Ljava/lang/StringBuilder;

    const-string v4, "[yk] v81 pc cmd telecom endCall="

    invoke-direct {v3, v4}, Ljava/lang/StringBuilder;-><init>(Ljava/lang/String;)V

    invoke-virtual {v3, v1}, Ljava/lang/StringBuilder;->append(Z)Ljava/lang/StringBuilder;

    move-result-object v3

    invoke-virtual {v3}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;

    move-result-object v3

    invoke-static {v2, v3}, Landroid/util/Log;->i(Ljava/lang/String;Ljava/lang/String;)I

    if-nez v1, :cond_pc_hangup_done

    const/4 v3, 0x0

    invoke-static {v0, v3}, Lcom/calltimer/app/HangupController;->run(Landroid/content/Context;Ljava/lang/Runnable;)V

    :cond_pc_hangup_done

    :try_end_0
    .catchall {:try_start_0 .. :try_end_0} :catchall_0

    :cond_1
    :goto_0
    goto :goto_1

    :catchall_0
    move-exception v0

    const-string v1, "pc cmd error"

    invoke-static {v1}, Lcom/calltimer/app/Diagnostic;->log(Ljava/lang/String;)V

    invoke-static {v0}, Landroid/util/Log;->getStackTraceString(Ljava/lang/Throwable;)Ljava/lang/String;

    move-result-object v1

    const-string v2, "CallTimerService"

    invoke-static {v2, v1}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I

    :goto_1
    sget-boolean v0, Lcom/calltimer/app/CallTimerService;->sPcWatch:Z

    if-eqz v0, :cond_2

    sget-object v0, Lcom/calltimer/app/CallTimerService;->sHBHandler:Landroid/os/Handler;

    if-eqz v0, :cond_2

    const-wide/16 v1, 0xc8

    invoke-virtual {v0, p0, v1, v2}, Landroid/os/Handler;->postDelayed(Ljava/lang/Runnable;J)Z

    :cond_2
    return-void
.end method
