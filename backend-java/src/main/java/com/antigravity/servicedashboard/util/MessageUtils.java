package com.antigravity.servicedashboard.util;

import org.springframework.context.MessageSource;
import org.springframework.context.NoSuchMessageException;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class MessageUtils {
    private static MessageSource messageSource;

    public MessageUtils(MessageSource messageSource) {
        MessageUtils.messageSource = messageSource;
    }

    public static String get(String key, Object... args) {
        if (messageSource == null) return key;
        try {
            return messageSource.getMessage(key, args, Locale.getDefault());
        } catch (NoSuchMessageException e) {
            return key;
        }
    }
}
