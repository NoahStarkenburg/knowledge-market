using AutoMapper;
using Domain.Contracts.Identity;
using Domain.Identity;

namespace Application.Users;

public sealed class UserProfile : Profile
{
    public UserProfile()
    {
        CreateMap<User, UserDto>()
            .ForCtorParam(nameof(UserDto.Id), o => o.MapFrom(s => s.Id))
            .ForCtorParam(nameof(UserDto.Email), o => o.MapFrom(s => s.Email.Value))
            .ForCtorParam(nameof(UserDto.RegisteredAt), o => o.MapFrom(s => s.RegisteredAt))
            .ForCtorParam(nameof(UserDto.IsEmailVerified), o => o.MapFrom(s => s.EmailVerifiedAt != null))
            .ForCtorParam(nameof(UserDto.DisplayName), o => o.MapFrom(s => s.DisplayName));
    }
}
