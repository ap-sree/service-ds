package com.antigravity.servicedashboard.mapper;

import org.mapstruct.Mapper;

import com.antigravity.servicedashboard.dto.AppConfigDTO;
import com.antigravity.servicedashboard.entity.AppConfig;

@Mapper(componentModel = "spring")
public interface AppConfigMapper {

    AppConfigDTO toDTO(AppConfig entity);

    AppConfig toEntity(AppConfigDTO dto);
}
