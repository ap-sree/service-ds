package com.antigravity.servicedashboard.mapper;

import com.antigravity.servicedashboard.dto.AppConfigDTO;
import com.antigravity.servicedashboard.entity.AppConfig;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface AppConfigMapper {

    AppConfigDTO toDTO(AppConfig entity);

    AppConfig toEntity(AppConfigDTO dto);
}
