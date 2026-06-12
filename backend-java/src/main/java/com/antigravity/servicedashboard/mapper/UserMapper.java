package com.antigravity.servicedashboard.mapper;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import com.antigravity.servicedashboard.dto.UserDTO;
import com.antigravity.servicedashboard.entity.User;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserDTO toDTO(User entity);

    List<UserDTO> toDTOList(List<User> entities);

    @Mapping(target = "preferences", ignore = true)
    User toEntity(UserDTO dto);
}
