import { useState, useEffect, useCallback, useRef } from "react";

export const useWebSocket = (url: string) => {
	const [lastMessage, setLastMessage] = useState<string | Blob | null>(null);
	const [connectionStatus, setConnectionStatus] =
		useState<string>("Disconnected");
	const webSocketRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const connect = useCallback(() => {
		if (webSocketRef.current?.readyState === WebSocket.OPEN) {
			console.log("WebSocket is already connected");
			return;
		}

		webSocketRef.current = new WebSocket(url);

		webSocketRef.current.onopen = () => {
			setConnectionStatus("Connected");
			console.log("WebSocket connected");
		};

		webSocketRef.current.onmessage = (event) => {
			setLastMessage(event.data);
		};

		webSocketRef.current.onerror = (error) => {
			console.error("WebSocket error:", error);
			setConnectionStatus("Error");
		};

		webSocketRef.current.onclose = (event) => {
			console.log("WebSocket closed:", event);
			setConnectionStatus("Disconnected");

			// Attempt to reconnect after 5 seconds
			reconnectTimeoutRef.current = setTimeout(() => {
				console.log("Attempting to reconnect...");
				connect();
			}, 5000);
		};
	}, [url]);

	useEffect(() => {
		connect();

		return () => {
			if (webSocketRef.current) {
				webSocketRef.current.close();
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [connect]);

	const sendMessage = useCallback((message: string) => {
		if (
			webSocketRef.current &&
			webSocketRef.current.readyState === WebSocket.OPEN
		) {
			webSocketRef.current.send(message);
		} else {
			console.error("WebSocket is not connected. Unable to send message.");
			// Optionally, you could queue messages here and send them when the connection is re-established
		}
	}, []);

	return { lastMessage, connectionStatus, sendMessage };
};
