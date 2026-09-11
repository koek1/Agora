// ========== Imports: ==========
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CalendarConnection } from './schemas/calendar-connection.schema';
import { Role } from '../common/enums/role.enums';
import { SsoProvider } from '../common/enums/sso-provider.enum';
import { UserTag } from '../common/enums/user-tag.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(data: {
    name: string;
    surname: string;
    email: string;
    passwordHash: string;
    role: Role;
    studyCenter: string;
    mustChangePassword?: boolean;
  }): Promise<UserDocument> {
    // Email uniqueness check (defence-in-depth — also enforced by index)
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already registered');

    const created = new this.userModel({
      ...data,
      email: data.email.toLowerCase(),
    });
    return created.save();
  }

  async linkSsoProvider(userId: string, provider: SsoProvider, ssoId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { ssoProvider: provider, ssoId } },
    ).exec();
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_MINUTES = 15;

    const user = await this.findById(userId);
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    }
    await user.save();
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0, lockedUntil: null } },
    ).exec();
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    // runValidators dwing die skema se eie reels (bv. name is required) ook op 'n
    // update af, Mongoose slaan dit andersins oor, sodat 'n veld wat verby die
    // DTO glip stilweg leeg geskryf sou word in plaas van hard te faal.
    const updated = await this.userModel
      .findByIdAndUpdate(id, { $set: updateUserDto }, { new: true, runValidators: true })
      .exec();
    if (!updated) throw new NotFoundException(`User ${id} not found`);
    return UserResponseDto.fromDocument(updated);
  }

  async changePassword( userId: string, passwordHash: string, passwordHistory: string[]): Promise <void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), passwordHistory } },
    ).exec();
  }

  async markPasswordExpired( userId: string ): Promise <void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { mustChangePassword: true } },
    ).exec();
  }

  async updateGoogleCalendarConnection(userId: string, connection: CalendarConnection): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { googleCalendar: connection } },
    ).exec();
  }

  async updateOutlookCalendarConnection(userId: string, connection: CalendarConnection): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { outlookCalendar: connection } },
    ).exec();
  }

  async clearGoogleCalendarConnection(userId: string): Promise<void> {
    await this.updateGoogleCalendarConnection(userId, {
      connected: false,
      accountEmail: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
  }

  async clearOutlookCalendarConnection(userId: string): Promise<void> {
    await this.updateOutlookCalendarConnection(userId, {
      connected: false,
      accountEmail: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
  }

  async search(role?: Role, q?: string, ids?: string[], tag?: UserTag): Promise<UserResponseDto[]> {
    const filter: FilterQuery<UserDocument> = {};

    if (role) filter.role = role;
    if (tag) filter.tags = tag;

    if ( ids && ids.length) {
      filter._id = { $in: ids };
    } else if (q && q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      filter.$or = [{ name: rx }, { surname: rx }];
    }

    const users = await this.userModel.find(filter).sort({ name: 1 }).exec();
    return users.map(UserResponseDto.fromDocument);
  }

    async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userModel.find().sort({ name: 1 }).exec();
    return users.map(UserResponseDto.fromDocument);
  }

  async deleteById(userId: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: userId }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`User ${userId} not found`);
  }
}
