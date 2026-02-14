package com.antigravity.servicedashboard.exception;

public class SslCertificateException extends RuntimeException {
    public SslCertificateException(String message) {
        super(message);
    }

    public SslCertificateException(String message, Throwable cause) {
        super(message, cause);
    }
}
