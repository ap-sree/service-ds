package com.antigravity.servicedashboard.converter;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.antigravity.servicedashboard.model.NotificationCondition;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class NotificationConditionConverter implements AttributeConverter<NotificationCondition, String> {

    private static final Logger logger = LoggerFactory.getLogger(NotificationConditionConverter.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(NotificationCondition attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            logger.error("Error converting NotificationCondition to JSON", e);
            return "{}";
        }
    }

    @Override
    public NotificationCondition convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) {
            return new NotificationCondition();
        }
        try {
            return objectMapper.readValue(dbData, NotificationCondition.class);
        } catch (IOException e) {
            logger.error("Error converting JSON to NotificationCondition", e);
            return new NotificationCondition();
        }
    }
}
