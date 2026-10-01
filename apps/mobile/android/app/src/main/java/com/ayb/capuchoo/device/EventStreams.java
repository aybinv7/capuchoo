package com.ayb.capuchoo.device;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Server-sent events behind a Bearer token, one thread per stream. EventSource cannot send an
 * Authorization header, so the WebView cannot hold `GET /api/apps/:id/stream` itself. A dropped
 * stream reconnects with backoff; a refused credential closes it for good.
 */
final class EventStreams {
    interface Listener {
        void message(String key, String event, String data);

        void state(String key, String state, String message);
    }

    /** The server pings every 25 s, so a read silent for longer than this is a dead connection. */
    private static final int READ_TIMEOUT_MS = 70_000;
    private static final long MAX_BACKOFF_MS = 60_000;

    private final Map<String, Stream> streams = new ConcurrentHashMap<>();
    private final Listener listener;

    EventStreams(Listener listener) {
        this.listener = listener;
    }

    void open(String key, String url, String token) {
        close(key);
        Stream stream = new Stream(key, url, token);
        streams.put(key, stream);
        stream.start();
    }

    void close(String key) {
        Stream stream = streams.remove(key);
        if (stream != null) stream.shutdown();
    }

    void closeAll() {
        for (String key : streams.keySet()) close(key);
    }

    private final class Stream extends Thread {
        private final String key;
        private final String url;
        private final String token;
        private volatile boolean stopped = false;
        private volatile HttpURLConnection connection;

        Stream(String key, String url, String token) {
            super("capuchoo-stream-" + key);
            setDaemon(true);
            this.key = key;
            this.url = url;
            this.token = token;
        }

        void shutdown() {
            stopped = true;
            HttpURLConnection current = connection;
            if (current != null) current.disconnect();
            interrupt();
        }

        @Override
        public void run() {
            long backoff = 2_000;
            while (!stopped) {
                try {
                    HttpURLConnection http = (HttpURLConnection) new URL(url).openConnection();
                    connection = http;
                    http.setRequestProperty("Authorization", "Bearer " + token);
                    http.setRequestProperty("Accept", "text/event-stream");
                    http.setConnectTimeout(20_000);
                    http.setReadTimeout(READ_TIMEOUT_MS);
                    int status = http.getResponseCode();
                    if (status == 401 || status == 403 || status == 404) {
                        listener.state(key, "closed", "The server answered " + status);
                        return;
                    }
                    if (status != 200) throw new IllegalStateException("The server answered " + status);

                    listener.state(key, "open", null);
                    backoff = 2_000;
                    read(http);
                } catch (Exception error) {
                    if (stopped) return;
                    listener.state(key, "retrying", error.getMessage());
                } finally {
                    HttpURLConnection current = connection;
                    if (current != null) current.disconnect();
                    connection = null;
                }
                if (stopped) return;
                try {
                    Thread.sleep(backoff);
                } catch (InterruptedException interrupted) {
                    return;
                }
                backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
            }
        }

        private void read(HttpURLConnection http) throws Exception {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(http.getInputStream(), StandardCharsets.UTF_8))) {
                String event = "message";
                StringBuilder data = new StringBuilder();
                String line;
                while (!stopped && (line = reader.readLine()) != null) {
                    if (line.isEmpty()) {
                        if (data.length() > 0) listener.message(key, event, data.toString());
                        event = "message";
                        data.setLength(0);
                    } else if (line.startsWith("event:")) {
                        event = line.substring(6).trim();
                    } else if (line.startsWith("data:")) {
                        if (data.length() > 0) data.append('\n');
                        data.append(line.substring(5).trim());
                    }
                }
            }
            if (!stopped) throw new IllegalStateException("The stream ended");
        }
    }
}
